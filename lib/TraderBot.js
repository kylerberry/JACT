const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s')
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

        this.tradeInterval = null
        this.orderPlaced = false
    }

    /**
     * Let the trading begin!
     * Subscribe to feed data and init trading
     * 
     * @return void
     */
    startTrading() {
        FeedService.subscribe('received', this.receivedHandler.bind(this))
        FeedService.subscribe('open', this.openHandler.bind(this))
        FeedService.subscribe('done', this.doneHandler.bind(this))
        FeedService.subscribe('activate', this.activateHandler.bind(this))
        this.trade()
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        spinner.stop(true)
        console.log(moment().format('M/D hh:mm:ss') + '\n')

        if (CandleProvider.hasData()) {
            HistoricDataProvider.append(CandleProvider.toArray())
        }

        let signal = this.strategy.signal(true)
        console.log(`signal: ${signal}\n`)
        
        if (signal == 'LONG') {
            this.buy()
        } else if (signal == 'SHORT') {
            this.sell()
        } else {
            console.log('>> No further action.\n')
            spinner.start()
        }

        this.tradeInterval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
    }

    /**
     * Order Received
     * @param {*} data 
     */
    receivedHandler(data) {
        console.log(data)

        if (this.orderPlaced) {
            console.log(`>> ${data.side} order received for ${data.size} @ $${data.price}. #${data.order_id}\n`)
            this.manager.addReceivedOrder(data)
        }
    }

    /**
     * Order open on book
     * @param {*} data 
     */
    openHandler(data) {
        // The order is now open on the order book. This message will only be sent for orders which are not fully filled immediately.remaining_size will indicate how much of the order is unfilled and going on the book.
        console.log(data)

        if (this.orderPlaced) {
            console.log(`>> ${data.side} order open for ${data.remaining_size} @ $${data.price}. #${data.order_id}\n`)
            // if partially filled, there could be > 1 open order for every received
            this.manager.addOpenOrder(data)
        }
        
    }

    /**
     * Order has been completed from the books
     * @param {*} data 
     */
    doneHandler(data) {
        // cancel of a stop loss order
        if (order.type == 'stop' && data.reason == 'canceled') {
            this.manager.removeStopOrder()
            return
        }

        if (this.orderPlaced && data.reason == 'filled') {
            // fully filled
            if (data.remaining_size == 0) {
                console.log(`>> ${data.side} order #${data.order_id} ${data.reason}.\n`)
                if (data.side == 'sell') {
                    this.cancelOrder(this.manager.getStopLoss())
                } else {
                    let lastReceived = this.manager.getLastReceived()
                    this.placeStopLoss({
                        size: lastReceived.size,
                        price: lastReceived.price * (1 - this.options.stopLoss)
                    })
                }
                this.manager.addFilledOrder(data)
                this.manager.removeOpenOrder()
                this.orderPlaced = false
                this.manager.info()
                return
            } 
            // partial fill
            else {

            }
        } else if (this.orderPlaced && data.reason == 'canceled') {
            // canceled stuff
        }
        console.log(data)
    }

    /**
     * Stop order has been placed
     * @param {*} data 
     */
    activateHandler(data) {
        console.log(data)
        this.manager.addStopOrder(data)
    }


    /**
     * Creates a stop order
     * 
     * @param {Object} orderToStop 
     */
    placeStopLoss(options = {}) {

        async function stopOrderAsync(options) {
            try {
                const data = await gdax.sell(options).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        let defaults = {
            type: 'stop',
            price: null,
            size: null,
            product_id: this.options.product
        }

        stopOrderAsync.call(this, Object.assign({}, defaults, options))
    }

    /**
     * Cancels an order
     * 
     * @param {Object} orderId 
     */
    cancelOrder(order) {
        async function cancelAsync(orderId) {
            console.log(`>> Canceling ${order.type == 'active' ? 'STOP' : order.type} order #${orderId}.\n`)
            try {
                const data = await gdax.cancelOrder(orderId).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        cancelAsync.call(this, order.order_id || order.id)
    }

    /**
     * Buy
     */
    buy(options = {}) {
        if (this.manager.getOpenOrder()) {
            console.log(">> Strategy signals buy, but there is an open order.\n")
            return
        }

        // use best_bid to make it more likely that our order will be bought quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(CandleProvider.get('best_bid'))

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

        let defaultOptions = {
            type: 'limit',
            price: CandleProvider.get('best_bid'),
            size: orderShares,
            product_id: this.options.product,
            side: 'buy',
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
        }

        buyAsync.call(this, Object.assign({}, defaultOptions, options))
    }

    /**
     * Sell
     */
    sell(options = {}) {

        if (this.manager.getOpenOrder()) {
            console.log(`>> Strategy signals sell, but there is an open order.\n`)
            return
        } else if (!this.manager.getLastFilled()) {
            console.log(`>> Strategy signals sell, but there is nothing to sell.\n`)
            return
        }

        // use best_ask to make it more likely that our order will be sold quickly while still avoiding fees
        let orderShares = this.manager.getOrderSize(CandleProvider.get('best_ask'))

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

        let defaults = {
            type: 'limit',
            price: CandleProvider.get('best_ask'),
            size: orderShares,
            product_id: this.options.product,
            side: 'sell',
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
        }

        // manually cancel partially filled and open new order like gekko
        sellAsync.call(this, Object.assign({}, defaults, options))
    }
 }

module.exports = TraderBot