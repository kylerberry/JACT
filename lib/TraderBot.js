const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s')
spinner.setSpinnerString(0);

// @todo need better error handling and logging
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

        this.tickerUpdates = 0
        this.tickerUpdatesMax = 10
    }

    /**
     * Let the trading begin!
     * Subscribe to feed data and init trading
     * 
     * @return void
     */
    startTrading() {
        console.log(`>> Trading ${this.options.product} every ${this.options.granularity} seconds with ${this.options.strategy} strategy.\n`)
        FeedService.subscribe('open', this.openHandler.bind(this))
        FeedService.subscribe('match', this.matchHandler.bind(this))
        FeedService.subscribe('done', this.doneHandler.bind(this))
        spinner.start()
        this.trade()
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        if (CandleProvider.hasData()) {
            HistoricDataProvider.append(CandleProvider.toArray())
        }

        let signal = this.strategy.signal()
        if (this.manager.shouldTriggerStop(CandleProvider.state().close)) {
            spinner.stop(true)
            console.log(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.stopLosses()
        } else if (signal == 'LONG') {
            spinner.stop(true)
            console.log(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            console.log('>> Signal: LONG')
            this.longPosition()
        } else if (signal == 'SHORT') {
            spinner.stop(true)
            console.log(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            console.log('>> Signal: SHORT')
            this.shortPosition()
        }

        this.tradeInterval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
    }

    /**
     * Place a stop loss order
     * 
     * @return void
     */
    stopLosses() {
        let openOrder = this.manager.getOpen()
        if (openOrder) {
            this.cancelOrder(openOrder.order_id)
        }

        this.placeOrder({
            side: 'sell',
            size: this.manager.getPosition().remaining_size,
            type: 'market',
            product_id: this.options.product
        })
    }

    /**
     * Open a position (buy)
     * 
     * @TODO if re-selling a canceled position and signal LONG, cancel sell order, and wait for next SHORT signal
     * // it seems this may already happen by happy accident
     * @return void
     */
    longPosition() {
        if (this.manager.getOpen()) {
            console.log(`>> Signal LONG, but there is an open order.\n`)
            return
        }

        if (this.manager.getPosition()) {
            console.log('>> Signal LONG but already long.\n')
            return
        }

        this.placeOrder({
            side: 'buy',
            size: this.manager.getOrderSize(CandleProvider.state().best_bid),
            price: CandleProvider.state().best_bid,
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
        })
    }

    /**
     * Close a position (sell)
     * 
     * @return void
     */
    shortPosition() {
        if (this.manager.getOpen()) {
            console.log(`>> Signal SHORT, but there is an open order.\n`)
            return
        }

        let position = this.manager.getPosition()
        if (!position) {
            console.log('>> Signal SHORT but nothing to short.\n')
            return
        }
        
        this.placeOrder({
            side: 'sell',
            size: position.size,
            price: CandleProvider.state().best_ask,
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
        })
    }

    /**
     * Place an order
     * 
     * @param {Object} options
     * @return void
     */
    placeOrder(options = {}) {
        if (!options.side || !options.size) {
            console.log(`side: '${options.side}' and size: '${options.size}' are required. No order placed.`)
            return
        }

        async function orderAsync(opts) {
            this.orderPlaced = true
            try {
                const data = await gdax[opts.side](opts).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                this.orderPlaced = false
                console.log(`>> ${err}\n`)
            }
        }

        let defaults = {
            type: 'limit',
            product_id: this.options.product,
            side: options.side
        }

        orderAsync.call(this, Object.assign({}, defaults, options))
    }

    /**
     * @TODO Manually cancel an order
     * 
     * @param {String} orderId 
     */
    cancelOrder(orderId) {
        async function cancelOrderAsync(id) {
            try {
                const data = await gdax.cancelOrder(id).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
                this.orderPlaced = false
                this.removeOpen(id)
            } catch (err) {
                this.orderPlaced = false
                console.log(`>> ${err}\n`)
            }
        }

        cancelOrderAsync(orderId)
    }

    /**
     * ticker update
     * used to cancel/place new orders every few orderbook changes
     * 
     * @param {Object} data
     * @return null
     */
    tickerHandler(data) {
        this.tickerUpdates++
        if (this.tickerUpdates >= this.tickerUpdatesMax) {
            // cancel any open order, place a new one
            this.tickerUpdates = 0
        }
    }

    /**
     * Order open on book
     * The order is now open on the order book. This message will only be sent for orders which are not fully filled immediately.remaining_size will indicate how much of the order is unfilled and going on the book.
     * 
     * @param {*} data 
     */
    openHandler(data) {
        if (!this.orderPlaced) {
            return
        }
        this.manager.addOpen(data)
        console.log(`>> #${data.order_id}: open.`)
    }

    /**
     * When a trade is matched(exchanged)
     */
    matchHandler(data) {
        if (!this.orderPlaced) {
            return
        }

        if (this.manager.getPosition()) {
            this.manager.updatePosition(data)
        } else {
            this.manager.openPosition(data)
        }

        console.log(`>> #${data.maker_order_id}: filled.`)
        this.manager.removeOpen(data.maker_order_id)
        this.manager.addFilled(data)
        spinner.start()
    }

    /**
     * Order has been completed from the books
     * Sent for all orders for which there was a received message
     * 
     * @param {*} data 
     */
    doneHandler(data) {
        if (!this.orderPlaced) {
            return
        }

        if (data.reason == 'canceled') {
            this.manager.removeOpen(data.order_id)
            console.log(`>> #${data.order_id}: canceled`)
            spinner.start()
        }

        let remainingSize = parseFloat(data.remaining_size)
        if (
            (data.reason == 'canceled' && data.side == 'sell') ||
            (data.reason == 'filled' && data.side == 'sell' && remainingSize !== 0)
        ) {
            console.log(`>> #${data.order} ${data.reason} ${data.side} w/ remaining ${remainingSize} ${this.options.product} @ $${data.price}.`)
            console.log(`>> Placing an immediate order to fill remaining size.\n`)
            this.placeOrder({
                side: data.side,
                size: remainingSize,
                price: CandleProvider.state().best_ask, //for now only sells open new orders
                post_only: true,
                time_in_force: 'GTT',
                cancel_after: 'min'
            })
        }

        if (remainingSize == 0 && data.reason == 'filled') {
            this.orderPlaced = false
            console.log(this.manager.info())
            console.log('\n')
        }
    }
}

module.exports = TraderBot