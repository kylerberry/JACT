const { gdax, websocket, DANGER_LIVE_GDAX_DANGER } = require('./gdax')
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
                this.realtimePriceData = data
            break
            case 'received':
                // @todo use order_id to confirm that we aren't setting an open order with an order that was placed outside of the bot
                // e.g. bot is running, Me (a human) places a limit order through the web GUI. bot sees this in the feed and
                // thinks it's an order it has placed, breaking the signal to buy/sell until the manually placed order is resolved
                this.manager.setOpenOrder(data)
            break
            case 'match':
                // @todo use order_id to confirm the order is from the bot
                // @todo partial buy and sell log as 2 seperate trades which is not accurate
                this.log(`${data.side.toUpperCase()} ${data.size} ${data.product_id} @ ${data.price}.`, data.side)
                this.manager.setLastTrade(data)
                this.manager.setOpenOrder() //reset the open order
                this.log(this.manager.info())
                this.log('No further action.')
            break
            case 'done':
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

        let count = 1
        // attempt to re-connect every 30 seconds.
        const interval = setInterval(() => {
            if (!websocket.socket) {
                count++;

                if (count % 30 === 0) {
                    this.log(`Websocket could not reconnect after ${count} attempts. Shutting down.`)
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

        websocket.on('message', this.onMessage)
        websocket.on('error', this.onError)
        websocket.on('close', this.onClose)
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
                console.log(`>> ${data}. No further action.\n`)
                spinner.start()
        }
    }

    /**
     * convert realtime data to a candle array for use with strategies
     */
    formatPriceData() {
        return [
            this.realtimePriceData.time,
            this.realtimePriceData.low_24h, // does not represent the current state
            this.realtimePriceData.high_24h, // does not represent the current state
            this.realtimePriceData.open_24h, // does not represent the current state
            this.realtimePriceData.price,
            this.realtimePriceData.volume_24h // does not represent the current state
        ]
    }

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
            try {
                const data = await gdax.buy(options)
                this.manager.setOpenOrder(data)
            } catch (err) {
                this.log(err, 'error')
            }
        }

        buyAsync({
            type: 'limit',
            price: this.realtimePriceData.best_bid,
            size: orderShares,
            product_id: this.options.product
        })

        // @todo place stop limit order
    }

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
            try {
                const data = await gdax.buy(options)
                this.manager.setOpenOrder(data)
            } catch (err) {
                this.log(err, 'error')
            }
        }

        sellAsync({
            type: 'limit',
            price: this.realtimePriceData.best_ask,
            size: orderShares,
            product_id: this.options.product
        })
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        spinner.stop(true)
        this.log(moment().format('M/D hh:mm:ss'))
        this.strategy.append(this.formatPriceData(this.realtimePriceData))
       
        let signal = this.strategy.signal()
        if (signal == 1) {
            this.buy()
        } else if (signal == 0) {
            this.sell()
        } else if (signal == -1) {
            this.log('No further action.')
        }

        this.interval = setTimeout(() => this.trade(), this.options.granularity * 1000)
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
        this.log('Shutting down.')
        process.exit()
    }
 }

module.exports = TraderBot