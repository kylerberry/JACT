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
                if (this.candle) {
                    this.candle.update(data)
                }
            break
            case 'received':
                if (this.orderPlaced) {
                    console.log(`>> BUY order placed for ${data.size} ${data.product_id} @ $${data.price}.\n`)
                    this.manager.setOpenOrder(data)
                    // dirty way to make sure the order was placed by the bot and not externally
                    this.orderPlaced = false
                }
            break
            case 'match':
                let open = this.manager.getOpenOrder()
                if (open && open.id == data.order_id) {
                    this.manager.setLastFilled(data)
                    console.log(`$$ ${open.side.toUpperCase()} ${data.size} ${data.product_id} @ ${data.price}.\n`)
                    console.log(this.manager.info())
                    console.log('')// newline
                    this.manager.setOpenOrder() //reset
                    spinner.start()
                }
            break
            case 'done':
                if (data.reason == 'canceled') {
                    let openOrder = this.manager.getOpenOrder()
                    if (openOrder && openOrder.id == data.order_id) {
                        this.manager.setOpenOrder()
                        console.log('>> No further action.\n')
                        spinner.start()
                    }
                }
            break
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
     * Buy
     */
    buy() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        // @todo maybe think about cancelling any open orders
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
            time_type: 'FOK' // avoid partial fills so sell orders don't get unexpected sizes
        })

        // @todo place stop limit order and target sell orders
    }

    /**
     * Sell
     */
    sell() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        // @todo maybe think about cancelling any open orders
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

        let signal = this.strategy.signal()
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