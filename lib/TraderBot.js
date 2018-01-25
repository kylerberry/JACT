const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const Candle = require('./Candle')
const moment = require('moment')
const HistoricDataProvider = require('./HistoricDataProvider')
let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s');
spinner.setSpinnerString(0);

class TraderBot {
    constructor({
        strategy,
        manager,
        options
    }) {
        this.strategy = strategy
        this.manager = manager
        this.options = options

        this.interval = null
        this.latestHeartbeat = moment()
        this.socketReconnect = true
        this.orderPlaced = false
        this.candle = null

        this.signalRangeHigh = .8 //buy signal must be greater than
        this.signalRangeLow = .2 //sell signal must be less than

        this.connectRealtimeFeed()
    }

    /**
     * Realtime feed messages
     * 
     * @param {Object} data
     * @return void
     */
    onMessage(data) {
        switch (data.type) {
            case 'subscriptions':
                console.log('>> WSS Feed online.\n')
            break
            case 'heartbeat':
                this.latestHeartbeat = moment(data.time)
            break
            case 'ticker':
                this.candle.update(data)
            break
            case 'received':
                // dirty way to make sure the order was placed by the bot and not externally
                let stopOrder = this.manager.getStopOrder()
                if (this.orderPlaced || (stopOrder && stopOrder.id == data.order_id)) {
                    if (stopOrder && stopOrder.id == data.order_id) {
                        console.log(`>> Stop loss triggered.\n`)
                    }
                    console.log(`>> ${data.side.toUpperCase()} order placed for ${data.size} ${data.product_id} @ $${data.price}. #${data.order_id}\n`)
                    // @todo this isn't always set in time before `match` tries to use. logs incorrect side
                    this.manager.setOpenOrder(data)
                    this.orderPlaced = false
                }
            break
            case 'done':
                // if this is too slow I may need to poll a local orderbook
                let open = this.manager.getOpenOrder()
                if (open && open.order_id == data.order_id) {
                    if (data.reason == 'filled') {
                        // this has to be set immediately for manager.info to output data correctly
                        this.manager.setLastFilled(open)
                        // if we sell our position and there's an open stop order
                        if (data.side == 'sell' && this.manager.getStopOrder()) {
                            // cancel it
                            this.cancelOrder(this.manager.getStopOrder())
                            console.log(this.manager.info())
                        } else if (data.side == 'buy') {
                            this.placeStopLoss(open) // using open because it has size prop
                        }
                    }
                    this.manager.setOpenOrder()
                    console.log(`>> Order #${data.order_id} ${data.reason}.\n`)
                }
            break
            case 'activate':
                // when a stop loss is placed
                this.manager.setStopOrder(data)
                console.log(`>> Placed stop loss for ${data.size} ${data.product_id} @ ${data.price}.\n`)
                spinner.start()
            default:
                return
        }
    }

    /**
     * Feed error
     * @param {Object} err 
     */
    onError(err) {
        console.log(`>> ${err}\n`)
    }

    /**
     * If feed closes, attempt to reconnect
     * @return null
     */
    onClose() {
        if (!this.socketReconnect) {
            console.log('>> Websocket connection closed.')
            return
        }

        console.log(`>> Websocket closed unexpectedly. Attempting to re-connect...`)
        websocket.connect()

        let tries = 1
        // attempt to re-connect every 30 seconds.
        const interval = setInterval(() => {
            if (!websocket.socket) {
                tries++;

                if (tries % 30 === 0) {
                    console.log(`>> Websocket could not reconnect after ${tries} attempts. Shutting down.`)
                    process.exit()
                }
                websocket.connect()
            }
            else {
                clearInterval(interval)
            }
        }, 30000);
    }

    /**
     * WSS Feed Data. Monitors feed health and sets latest price data
     * @return void
     */
    connectRealtimeFeed() {
        const maxSkippedBeats = 15

        const heartbeatInterval = setInterval(() => {
            let now = new moment()
            if (now.diff(this.latestHeartbeat, 'seconds') >= maxSkippedBeats) {
                console.log('>> Websocket skipped a beat. Attempting to reconnect...')
                clearInterval(heartbeatInterval)
                // close connection
                websocket.socket.close()
            }
        }, 1000)

        websocket.on('message', this.onMessage.bind(this))
        websocket.on('error', this.onError.bind(this))
        websocket.on('close', this.onClose.bind(this))
    }

    /**
     * Creates a stop order
     * 
     * //if stop loss get's hit, compare it to the id in the feed
     * //if orderToStop is sold before the stop loss, cancel the stop loss order
     * @param {Object} orderToStop 
     */
    placeStopLoss(orderToStop) {
        let stopPrice = orderToStop.price * (1 - this.options.stopLoss)

        async function buyAsync(options) {
            try {
                const data = await gdax.sell(options).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        buyAsync.call(this, {
            type: 'stop',
            price: stopPrice,
            size: orderToStop.size,
            product_id: this.options.product
        })
    }

    /**
     * Cancels an order
     * 
     * @param {Object} orderId 
     */
    cancelOrder(order) {
        let stopOrder = this.manager.getStopOrder()

        async function cancelAsync(orderId) {
            console.log(`>> Canceling ${order.type == 'active' ? 'STOP' : order.type} order #${orderId}.\n`)
            try {
                const data = await gdax.cancelOrder(orderId).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
                //reset stop
                if (order.type == 'stop') {
                    this.manager.setStopOrder()
                }
                //if stop loss get's hit, compare it to the id in the feed
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        cancelAsync.call(this, order.order_id || order.id)
    }

    /**
     * Buy
     */
    buy() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        if (this.manager.getOpenOrder()) {
            console.log(">> Strategy signals buy, but there is an open order.\n")
            return
        }
        if (lastTrade && lastTrade.side == 'buy') {
            console.log(">> Strategy signals buy, but last trade was a 'buy'.\n")
            return
        }

        // use best_bid to make it more likely that our order will be bought quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(this.candle.get('best_bid'))

        async function buyAsync(options) {
            this.orderPlaced = true
            try {
                const data = await gdax.buy(options).catch(err => { throw new Error(err)})
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                this.orderPlaced = false
                console.log(`>> ${err}\n`)
            }
        }

        buyAsync.call(this, {
            type: 'limit',
            price: this.candle.get('best_bid'),
            size: orderShares,
            product_id: this.options.product,
            side: 'buy',
            // FOK was creating taker fees
            time_in_force: 'GTT', // good 'til canceled
            cancel_after: 'min'
        })
    }

    /**
     * Sell
     */
    sell() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        if (this.manager.getOpenOrder()) {
            console.log(`>> Strategy signals sell, but there is an open order.\n`)
            return
        } else if (!lastTrade) {
            console.log(`>> Strategy signals sell, but there is nothing to sell.\n`)
            return
        } else if (lastTrade.side == 'sell') {
            console.log(`>> Strategy signals sell, but last trade was a 'sell'.\n`)
            return
        }

        // use best_ask to make it more likely that our order will be sold quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(this.candle.get('best_ask'))

        async function sellAsync(options) {
            this.orderPlaced = true
            try {
                const data = await gdax.sell(options).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                this.orderPlaced = false
                console.log(`>> ${err}`)
            }
        }

        sellAsync.call(this, {
            type: 'limit',
            price: this.candle.get('best_ask'),
            size: orderShares,
            product_id: this.options.product,
            side: 'sell'
        })
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        spinner.stop(true)
        console.log(moment().format('M/D hh:mm:ss')+'\n')

        if (this.candle) {
            HistoricDataProvider.append(this.candle.toArray())
        }

        let signal = this.strategy.signal(true)
        console.log(`signal: ${signal}\n`)
        if (signal > this.signalRangeHigh) {
            this.buy()
        } else if (signal < this.signalRangeLow) {
            this.sell()
        } else {
            console.log('>> No further action.\n')
            spinner.start()
        }

        this.candle = new Candle()

        this.interval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
    }

    /**
     * Let the trading begin!
     * @return void
     */
    startTrading() {
        this.trade()
    }

    /**
     * That's enough.
     * @return void
     */
    stopTrading() {
        clearInterval(this.interval)
        console.log('>> Shutting down.')
        process.exit()
    }
 }

module.exports = TraderBot