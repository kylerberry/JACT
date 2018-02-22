const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s')
spinner.setSpinnerString(0);

// @TODO need better error handling and logging
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

        this.signaledBuyPrice = null
        this.signaledSellPrice = null
        this.stopLossTriggered = false
    }

    /**
     * Nice logging wrapper
     * 
     * @param {Mixed} message 
     */
    logger(message) {
        if (this.options.logging) {
            console.log(message)
        }
    }

    /**
     * Let the trading begin!
     * Subscribe to feed data and init trading
     * 
     * @return void
     */
    startTrading() {
        this.logger(`>> Trading ${this.options.product} every ${this.options.granularity} seconds with ${this.options.strategy} strategy.\n`)
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
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: STOP LOSS')
            this.stopLosses()
        } else if (signal == 'LONG') {
            spinner.stop(true)
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: LONG')
            this.longPosition()
        } else if (signal == 'SHORT') {
            spinner.stop(true)
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: SHORT')
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
        let currentPosition = this.manager.getCurrentRemainingPositionSize()
        if (!currentPosition) {
            this.logger('>> Signal STOP LOSS but no position to sell.')
            return
        }

        this.stopLossTriggered = true
        let openOrder = this.manager.getOpen()
        if (openOrder) {
            this.cancelOrder(openOrder.order_id)
        }

        this.placeOrder({
            side: 'sell',
            size: currentPosition,
            type: 'market',
            product_id: this.options.product
        })
    }

    /**
     * Open a position (buy)
     * 
     * @return void
     */
    longPosition() {
        if (this.manager.getCurrentRemainingPositionSize()) {
            this.logger('>> Signal LONG but already long.\n')
            return
        }

        let bestBid = CandleProvider.state().best_bid
        this.signaledBuyPrice = bestBid

        this.placeOrder({
            side: 'buy',
            size: this.manager.getOrderSize(bestBid),
            price: bestBid,
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
        let positionSize = this.manager.getCurrentRemainingPositionSize()
        if (!positionSize) {
            this.logger('>> Signal SHORT but nothing to short.\n')
            return
        }

        let bestAsk = CandleProvider.state().best_ask
        this.signaledSellPrice = bestAsk
        
        this.placeOrder({
            side: 'sell',
            size: positionSize,
            price: bestAsk,
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
            this.logger(`side: '${options.side}' and size: '${options.size}' are required. No order placed.`)
            return
        }

        async function orderAsync(opts) {
            this.orderPlaced = true

            try {
                const data = await gdax[opts.side](opts).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                    this.orderPlaced = false
                }

                // if stop loss order, we can't rely on feed 'done' event because
                // market orders never get placed on the orderbook
                if (this.stopLossTriggered) {
                    this.manager.addFilled(data)
                    this.resetFlags()
                    this.logger(this.manager.info())
                    this.logger('\n')
                    spinner.start()
                }
            } catch (err) {
                this.resetFlags()
                this.logger(`>> ${err}\n`)
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
                this.removeOpen(id)
            } catch (err) {
                this.logger(`>> ${err}\n`)
            }
        }

        cancelOrderAsync(orderId)
    }

    /**
     * Order open on book
     * The order is now open on the order book. This message will only be sent for orders which are not fully filled immediately.remaining_size will indicate how much of the order is unfilled and going on the book.
     * 
     * @param {Object} data 
     */
    openHandler(data) {
        if (!this.orderPlaced || this.stopLossTriggered) {
            return
        }

        this.manager.addOpen(data)
        this.logger(`>> #${data.order_id}: open.`)
    }

    /**
     * When a trade is matched(exchanged)
     * 
     * @param {Object} data
     */
    matchHandler(data) {
        if (!this.orderPlaced || this.stopLossTriggered) {
            return
        }

        this.manager.addFilled(data)
    }

    /**
     * Order has been completed from the books
     * Sent for all orders for which there was a received message
     * 
     * @param {Object} data 
     */
    doneHandler(data) {
        if (!this.orderPlaced || this.stopLossTriggered) {
            return
        }

        this.manager.removeOpen(data.order_id)
        let remainingSize = parseFloat(data.remaining_size)
        let bestBid = CandleProvider.state().best_bid

        this.logger(`>> #${data.order_id} ${data.reason} ${data.side} w/ remaining ${remainingSize} ${this.options.product} @ $${data.price}.`)
        if (this.shouldReplaceOrder(data, bestBid)) {
            this.logger(`>> Placing an immediate order to fill remaining size.\n`)
            this.placeOrder({
                side: data.side,
                size: remainingSize,
                price: data.side == 'sell' ? CandleProvider.state().best_ask : bestBid,
                post_only: true,
                time_in_force: 'GTT',
                cancel_after: 'min'
            })
        }

        // show info, wait for next signal
        if (
            (data.side == 'buy' && data.reason == 'filled') ||
            (data.side == 'sell' && data.reason == 'filled' && remainingSize == 0)
        ) {
            this.resetFlags()
            this.logger(this.manager.info())
            this.logger('\n')
            spinner.start()
        }
    }

    /**
     * Reset flags once an order is fully filled and completed
     */
    resetFlags() {
        this.orderPlaced = false
        this.signaledBuyPrice = null
        this.signaledSellPrice = null
        this.stopLossTriggered = false
    }

    /**
     * Abstract away some of the doneHandler replace order logic
     * 
     * @param {*} data 
     * @return {Boolean}
     */
    shouldReplaceOrder(data, price) {
        let remainingSize = parseFloat(data.remaining_size)
        let bidAllowed = this.manager.isBidAllowed(this.signaledBuyPrice, price)

        if (data.reason == 'canceled' && data.side == 'buy' && !bidAllowed) {
            this.logger('>> Max slippage won\'t allow a replacement order.\n')
        }
        return !this.stopLossTriggered &&
            (data.reason == 'canceled' && data.side == 'sell') ||
            (data.reason == 'canceled' && data.side == 'buy' && bidAllowed) ||
            (data.reason == 'filled' && data.side == 'sell' && remainingSize !== 0)
    }
}

module.exports = TraderBot