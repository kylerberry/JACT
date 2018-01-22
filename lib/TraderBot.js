const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')
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
        this.realtimePriceData = null
        this.latestHeartbeat = moment()
        this.socketReconnect = true
        this.orderPlaced = false

        this.connectRealtimeFeed()
    }

    /**
     * Realtime feed messages
     * 
     * @param {Object} data
     * @return void
     */
    onMessage(data) {
        // console.log(data)
        switch (data.type) {
            case 'subscriptions':
                console.log('>> WSS Feed online.\n')
            break
            case 'heartbeat':
                this.latestHeartbeat = moment(data.time)
            break
            case 'ticker':
                this.realtimePriceData = data
            break
            case 'received':
                // from gdax: The REST response with a server order_id may come after the received message in the public data feed.
                // @todo probably shouldn't set openOrder from the REST response of buy/sell
                if (this.orderPlaced) {
                    this.log(`BUY order placed for ${data.size} ${data.product_id} @ $${data.price}`)
                    this.manager.setOpenOrder(data)
                    // dirty way to mak sure the order was placed by the bot and not externally
                    this.orderPlaced = false
                }
            break
            case 'match':
                let open = this.manager.getOpenOrder()
                if (open && open.id == data.order_id) {
                    this.log(`${data.size} ${data.product_id} @ ${data.price}.`, open.side)
                    // @todo figure out how to track last filled when it's partially filled in 2 orders
                    this.manager.setLastFilled(data)
                    this.manager.setOpenOrder()
                    this.log('No further action')
                    spinner.start()
                }
            break
            case 'done':
                console.log(data)
                // when order is removed from book data.reason == 'filled' or 'canceled'
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
        this.log(err, 'error')
    }

    /**
     * If feed closes, attempt to reconnect
     * @return null
     */
    onClose() {
        if (!this.socketReconnect) {
            this.log('Websocket connection closed.')
            return
        }

        this.log(`Websocket closed unexpectedly. Attempting to re-connect...`)
        websocket.connect()

        let tries = 1
        // attempt to re-connect every 30 seconds.
        const interval = setInterval(() => {
            if (!websocket.socket) {
                tries++;

                if (tries % 30 === 0) {
                    this.log(`Websocket could not reconnect after ${tries} attempts. Shutting down.`)
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
                this.log('Websocket skipped a beat. Attempting to reconnect...')
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
     * Console Log method
     * 
     * @param {Mixed} data
     * @param {String} type
     */
    log(data, type) {
        switch (type) {
            case 'buy':
                console.log(`** ${data}\n`)
            break
            case 'sell':
                console.log(`$$ ${data}\n`)
            break
            case 'error':
                console.log(`>> ERROR: ${data}\n`)
            break
            default:
                console.log(`>> ${data}.\n`)
        }
    }

    /**
     * Convert realtime data to a candle array for use with strategies
     */
    formatPriceData() {
        return [
            moment(this.realtimePriceData.time).unix(),
            parseFloat(this.realtimePriceData.low_24h), // does not represent the current state
            parseFloat(this.realtimePriceData.high_24h), // does not represent the current state
            parseFloat(this.realtimePriceData.open_24h), // does not represent the current state
            parseFloat(this.realtimePriceData.price),
            parseFloat(this.realtimePriceData.volume_24h) // does not represent the current state
        ]
    }

    /**
     * Buy
     */
    buy() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        // @todo maybe think about cancelling any open orders
        if (this.manager.getOpenOrder()) {
            this.log("Strategy signals buy, but there is an open order.")
            return
        }
        if (lastTrade && lastTrade.side == 'buy') {
            this.log("Strategy signals buy, but last trade was a 'buy'.")
            return
        }

        // use best_bid to make it more likely that our order will be bought quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(this.realtimePriceData.best_bid)

        async function buyAsync(options) {
            this.orderPlaced = true
            try {
                const data = await gdax.buy(options).catch(err => { throw new Error(err)})
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                this.orderPlaced = false
                this.log(err, 'error')
            }
        }

        buyAsync.call(this, {
            type: 'limit',
            price: this.realtimePriceData.best_bid,
            size: orderShares,
            product_id: this.options.product,
            side: 'buy',
            time_type: 'FOK'
        })

        // @todo place stop limit order
    }

    /**
     * Sell
     */
    sell() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        // @todo maybe think about cancelling any open orders
        if (this.manager.getOpenOrder()) {
            this.log(`Strategy signals sell, but there is an open order.`)
            return
        } else if (!lastTrade) {
            this.log(`Strategy signals sell, but there is nothing to sell.`)
            return
        } else if (lastTrade.side == 'sell') {
            this.log(`Strategy signals sell, but last trade was a 'sell'.`)
            return
        }

        // use best_ask to make it more likely that our order will be sold quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(this.realtimePriceData.best_ask)

        async function sellAsync(options) {
            this.orderPlaced = true
            try {
                const data = await gdax.sell(options).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                this.orderPlaced = false
                this.log(err, 'error')
            }
        }

        sellAsync.call(this, {
            type: 'limit',
            price: this.realtimePriceData.best_ask,
            size: orderShares,
            product_id: this.options.product,
            side: 'sell',
            time_type: 'FOK'
        })
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        spinner.stop(true)
        this.log(moment().format('M/D hh:mm:ss'))

        if (this.realtimePriceData) {
            this.strategy.append(this.formatPriceData(this.realtimePriceData))
        }

        let signal = this.strategy.signal()
        if (signal == 1) {
            this.buy()
        } else if (signal == 0) {
            this.sell()
        } else if (signal == -1) {
            this.log('No further action')
            spinner.start()
        }

        this.interval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
    }

    /**
     * Let the trading begin!
     * @return void
     */
    startTrading() {
        // breaking websocket feed into a separate service could mitigate waiting for realtimeData
        let waitForData = setInterval(() => {
            if (this.realtimePriceData) {
                this.trade()
                clearInterval(waitForData)
            }
        }, 200)
    }

    /**
     * That's enough.
     * @return void
     */
    stopTrading() {
        clearInterval(this.interval)
        this.log('Shutting down.')
        process.exit()
    }
 }

module.exports = TraderBot