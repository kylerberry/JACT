/**
 useful strategies/combinations?
 - buy on oversold, sell on KST bearish cross
 - KST
 - stochRSI
 - buy on MACD bull cross only when OBV is positive, sell on bearish cross
 - MACD
 - in a bearish trend (1hr candles): buy on oversold reversal of RSI, sell on red candle close below 10 day MA
 - candlestick analysis
 */

/**
 * creates a new trade implementation
 */

const { gdax, websocket, DANGER_LIVE_GDAX_DANGER } = require('./gdax')
const moment = require('moment')
var Spinner = require('cli-spinner').Spinner;

var spinner = new Spinner('waiting... %s');
spinner.setSpinnerString(0);

class TradingBot {
    constructor(options) {
        this.strategy = options.strategy
        this.account = options.account
        
        this.stopLoss = .07 //default
        this.ticker = null
        this.product = null
        this.granularity = null
        this.socketReconnect = true
        this.latestHeartbeat = new moment()

        // @todo this should be it's own class with get/set methods
        this.historicData = []

        // @todo use this to implement a stop loss solution
        this.realtimePriceData = {}
    }

    /**
     * Set stop loss based on product 60-day volatility
     * 
     * @param {String} product 
     */
    _setStopLossForProduct(product) {
        const productVolatility = {
            'LTC-USD' : .12,
            'ETH-USD' : .04,
            'BTC-USD': .06
        }
        this.stopLoss = productVolatility[product]
    }

    /**
     * Buy
     * @todo buy/sell should be handle by account 'portfolio', as a separate strategy
     */
    _buy(options) {
        const self = this

        let lastTrade = this.account.getLastTrade()
        let d = new Date()

        // @todo maybe think about cancelling any open orders
        if (this.account.getOpenOrder()) {
            console.log(`>> Strategy signals buy, but there is an open order.\n`)
            this._wait()
            return
        }
        if (lastTrade && lastTrade.side == 'buy') {
            console.log(`>> Strategy signals buy, but last trade was a 'buy'.\n`)
            this._wait()
            return
        }

        // use best_ask to make it more likely that our limit will be bought
        let orderShares = this.account.getOrderSize(this.product.split('-')[1], this.realtimePriceData.best_bid)

        let defaultOpts = {
            type: 'limit', //limit
            price: this.realtimePriceData.best_bid, // different ways to handle https://github.com/askmike/gekko/issues/919
            size: orderShares,
            product_id: this.product
        }

        let buyParams = Object.assign({}, defaultOpts, options)


        gdax.buy(buyParams, (err, res, data) => {
            if (err) {
                console.log(`>> Unsuccessful BUY for ${orderShares} ${self.product} at ${self.realtimePriceData.best_bid}. ${err} \n`)
                return
            }

            if (data.message) {
                console.log(`>> Unsuccessful BUY for ${orderShares} ${self.product} at ${self.realtimePriceData.best_bid}. ${data.message} \n`)
                return
            }

            console.log(`>> BUY order placed for ${orderShares} ${self.product} at ${self.realtimePriceData.best_bid}. OrderId: ${data.id}\n`)
        })
    }

    /**
     * Sell
     */
    _sell(options = {}) {
        const self = this

        let lastTrade = this.account.getLastTrade()
        let d = new Date()

        // @todo maybe think about cancelling any open orders
        if (this.account.getOpenOrder()) {
            console.log(`>> Strategy signals sell, but there is an open order.\n`)
            this._wait()
            return
        } else if (!lastTrade) {
            console.log(`>> Strategy signals sell, but there is nothing to sell.\n`)
            this._wait()
            return
        } else if (lastTrade.side == 'sell') {
            console.log(`>> Strategy signals sell, but last trade was a 'sell'.\n`)
            this._wait()
            return
        }

        let orderShares = lastTrade.size

        let defaultOpts = {
            type: 'limit',
            price: this.realtimePriceData.best_ask,
            size: orderShares,
            product_id: this.product
        }

        let sellParams = Object.assign({}, defaultOpts, options)

        gdax.sell(sellParams, (err, res, data) => {
            if (err) {
                console.log(`>> Unsuccessful SELL for ${orderShares} ${self.product} at ${this.realtimePriceData.best_ask}. ${err} \n`)
                return
            }

            if (data.message) {
                console.log(`>> Unsuccessful SELL for ${orderShares} ${self.product} at ${this.realtimePriceData.best_ask}. ${data.message} \n`)
                return
            }

            // @todo get id of this order, check feed for status
            console.log(`>> SELL order placed for ${orderShares} ${self.product} at ${this.realtimePriceData.best_ask}. OrderId: ${data.id}\n`)
        })
    }

    /**
     * No Buy or Sell
     */
    _wait() {
        console.log(`\n>> No further action. \n`)
        spinner.start() // log heartbeat
    }

    /**
     * WSS on message event
     * 
     * @param {*} data 
     */
    _feedOnMessage(data) {
        switch(data.type) {
            case 'subscriptions':
                console.log('>> WSS Feed online.\n')
                return
            break
            case 'heartbeat':
                this.latestHeartbeat = moment(data.time)
                return
            break
            case 'ticker':
                this.realtimePriceData = data
                return
            break
            case 'received':
                // @todo make sure we don't pull old data from the feed

                // @todo use order_id to confirm that we aren't setting an open order with an order that was placed outside of the bot
                // e.g. bot is running, Me (a human) places a limit order through the web GUI. bot sees this in the feed and
                // thinks it's an order it has placed, breaking the signal to buy/sell until the manually placed order is resolved
                this.account.setOpenOrder(data)
                return
            break
            case 'match':
                // @todo use order_id to confirm the order is from the bot
                // @todo partial buy and sell log as 2 seperate trades which is not accurate
                console.log(`$$ SUCCESSFUL ${data.side.toUpperCase()} ${data.size}  ${data.product_id} @ ${data.price}.\n`)
                this.account.setLastTrade(data)
                this.account.setOpenOrder() //reset the open order
                console.log(this.account.info())
                this._wait() // @todo turn into a log method instead
                return
            break
            case 'done':
                // when order is removed from book data.reason == 'filled' or 'canceled'
            break
            default:
                return
        }
    }

    /**
     * WSS on close event
     */
    _feedOnClose() {
        if (!this.socketReconnect) {
            console.log('>> Websocket connection closed.')
            return
        }

        console.log(`>> Websocket closed unexpectedly. Attempting to re-connect...`)
        websocket.connect()

        let count = 1
        // attempt to re-connect every 30 seconds.
        const interval = setInterval(() => {
            if (!websocket.socket) {
                count++;

                if (count % 30 === 0) {
                    console.log(`>> Websocket could not reconnect after ${count} attempts. Shutting down.`)
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
     * convert realtime data to a candle array for use with strategies
     */
    _currentCandle() {
        return [
            this.realtimePriceData.time,
            this.realtimePriceData.low_24h, // does not represent the current state
            this.realtimePriceData.high_24h, // does not represent the current state
            this.realtimePriceData.open_24h, // does not represent the current state
            this.realtimePriceData.price,
            this.realtimePriceData.volume_24h // does not represent the current state
        ]
    }

    /**
     * Gets the latest series of price data for a product using historical and wss feed data
     * 
     * @param function callback
     */
    getData() {
        const self = this
        return new Promise((resolve, reject) => {

            if (!self.historicData.length) {
                DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(self.product, {
                    granularity: self.granularity || 3600
                }, (err, res, data) => {
                    if (err) {
                        return reject(err)
                    }

                    if (data.length) {
                        if (self.realtimePriceData.price) {
                            // @todo this needs to be an array with price at [4] for macd
                            // works but looks nasty and doesn't work for other strategies
                            data.unshift(self._currentCandle())
                            data.pop()
                        }

                        self.historicData = data
                        resolve(data)
                    }

                    return reject({
                        message: 'No Data'
                    })
                })
            } else {
                self.historicData.unshift(self._currentCandle())
                self.historicData.pop()
                resolve(self.historicData)
            }
        })
    }

    /**
     * WSS Feed Data. Monitors feed health and sets latest price data
     * @todo would be a good use case for RxJs
     */
    _connectFeed() {
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

        websocket.on('message', this._feedOnMessage.bind(this));
        websocket.on('error', err => { console.log(err) })
        websocket.on('close', this._feedOnClose.bind(this));
    }

    /**
     * close position if price falls below stop
     * 
     * @param {*} data 
     */
    _ifPriceBelowStop(data) {
        let lastTrade = this.account.getLastTrade()
        return lastTrade
            && lastTrade.side == 'buy'
            && data.price < lastTrade.price - (lastTrade.price * this.stopLoss)
    }

    /**
     * Creates a market sell (incurs fees) as stop loss
     * 
     * @param {*} data 
     */
    _triggerStopLoss(data) {
        this._sell({
            type: 'market',
            price: data.price,
            size: this.account.getLastTrade().size
        })
    }

    /**
     * Execute a strategy with a historical dataset
     */
    _trade() {
        spinner.stop(true)
        console.log(moment().format('M/D hh:mm:ss'))
        const self = this
        this.getData().then(data => {

            // trigger stop loss protection
            if (self._ifPriceBelowStop.bind(self)(data)) {
                self._triggerStopLoss.bind(self)(data)
            } else {
                self.strategy({
                    values: data,
                    price: self.realtimePriceData.price
                }).execute({
                    buy: self._buy.bind(self),
                    sell: self._sell.bind(self),
                    wait: self._wait.bind(self)
                })
            }

            self.ticker = setTimeout(() => self._trade(), (self.granularity * 1000))
        }).catch(err => {
            console.log(`>> Something went wrong. ${err.message}`)
            self._wait()
        })
    }

    /**
     * Begins trading
     *
     * @param intervalSeconds | 60 seconds is minimum
     * @return void
     */
    startTrading(options) {
        this.product = options.product
        this.granularity = parseInt(options.granularity, 10)
        this._connectFeed()
        this._setStopLossForProduct(options.product)

        // give WSS a second to catch up
        setTimeout(this._trade.bind(this), 1000)
    }

    /**
     * Stops trading
     * 
     * @param {*} options 
     * @return void
     */
    stopTrading(options) {
        // add option to wait for a sell order to shutdown
        console.log('>> Shutting down.\n')
        clearTimeout(this.ticker)
        process.exit()
    }
}

module.exports = TradingBot