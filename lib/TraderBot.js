const { gdax, websocket } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')
const manager = require('./PortfolioManager')
const strategy = require('./Strategy')()
const config = require('./ConfigProvider')

let trader = null

class TraderBot {
    constructor() {
        this.tradeInterval = null

        this.signaledBuyPrice = null
        this.signaledSellPrice = null
        this.stopLossTriggered = false
        this.ordersResolved = true
        trader = this
    }

    /**
     * Nice logging wrapper
     * 
     * @TODO separate into an external service
     * @param {Mixed} message 
     */
    logger(message) {
        if (config.get('logging')) {
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
        this.logger(`>> Trading ${config.get('product')} every ${config.get('granularity')} seconds with ${config.get('strategy')} strategy.\n`)
        FeedService.subscribe('open', this.openHandler.bind(this))
        FeedService.subscribe('match', this.matchHandler.bind(this))
        FeedService.subscribe('done', this.doneHandler.bind(this))
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

        let signal = strategy.signal()
        if (manager.shouldTriggerStop(CandleProvider.state().close)) {
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: STOP LOSS')
            this.stopLosses()
        } else if (signal == 'LONG') {
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: LONG')
            this.longPosition()
        } else if (signal == 'SHORT') {
            this.logger(moment().utc().format('M/D HH:mm:ss UTC') + '\n')
            this.logger('>> Signal: SHORT')
            this.shortPosition()
        }

        this.tradeInterval = setTimeout(this.trade.bind(this), config.get('granularity') * 1000)
    }

    /**
     * Place a stop loss order
     * 
     * @return void
     */
    stopLosses() {
        let currentPosition = manager.getPositionSize()
        if (currentPosition < manager.getMinimumOrderSize()) {
            this.logger('>> Signal STOP LOSS but no position to sell.')
            return
        }

        this.stopLossTriggered = true
        let openOrder = manager.getOpen()
        if (openOrder) {
            this.cancelOrder(openOrder.order_id)
        }

        this.placeOrder({
            side: 'sell',
            size: currentPosition,
            type: 'market',
            product_id: config.get('product')
        })
    }

    /**
     * Open a position (buy)
     * 
     * @return void
     */
    longPosition() {
        if (!this.ordersResolved) {
            this.logger('>> Cannot buy while there is an unresolved order.')
            return
        }
        let positionSize = manager.getPositionSize()
        let minimumSize = manager.getMinimumOrderSize()
        if (positionSize >= minimumSize) {
            this.logger('>> Signal LONG but already long.\n')
            return
        }

        let bestBid = CandleProvider.state().best_bid
        this.signaledBuyPrice = bestBid

        this.placeOrder({
            side: 'buy',
            size: manager.getOrderSize(bestBid),
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
        if (!this.ordersResolved) {
            this.logger('>> Cannot sell while there is an unresolved order.')
            return
        }
        let positionSize = manager.getPositionSize()
        let minimumSize = manager.getMinimumOrderSize()
        if (positionSize < minimumSize) {
            this.logger('>> Signal SHORT but nothing to sell.\n')
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
                if (this.stopLossTriggered && data.side == 'sell') {
                    manager.addFilled(data)
                    this.resetFlags()
                    this.logger(manager.info())
                    this.logger('\n')
                }
            } catch (err) {
                this.resetFlags()
                this.logger(`>> ${err}\n`)
            }
        }

        let defaults = {
            type: 'limit',
            product_id: config.get('product'),
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
        if (!this.orderPlaced) {
            return
        }

        manager.addOpen(data)
        this.logger(`>> #${data.order_id}: open.`)
    }

    /**
     * When a trade is matched(exchanged)
     * 
     * @param {Object} data
     */
    matchHandler(data) {
        if (!this.orderPlaced) {
            return
        }

        manager.addFilled(data)
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
        manager.removeOpen(data.order_id)
        let remainingSize = parseFloat(data.remaining_size)
        let bestBid = CandleProvider.state().best_bid

        this.logger(`>> #${data.order_id} ${data.reason} ${data.side} w/ remaining ${remainingSize} ${config.get('product')} @ $${data.price}.`)
        if (this.shouldReplaceOrder(data, bestBid)) {
            this.ordersResolved = false
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
            (data.side == 'sell' && data.reason == 'filled' && remainingSize < manager.getMinimumOrderSize())
        ) {
            this.resetFlags()
            this.logger(manager.info())
            this.logger('\n')
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
        this.ordersResolved = true
    }

    /**
     * Abstract away some of the doneHandler replace order logic
     * 
     * @param {*} data 
     * @return {Boolean}
     */
    shouldReplaceOrder(data, price) {
        let remainingSize = parseFloat(data.remaining_size)
        let bidAllowed = manager.isBidAllowed(this.signaledBuyPrice, price)
        let minimumSize = manager.getMinimumOrderSize()

        if (data.reason == 'canceled' && data.side == 'buy' && !bidAllowed) {
            this.logger('>> Max slippage won\'t allow a replacement order.\n')
        }
        return (data.reason == 'canceled' && data.side == 'sell') ||
            (data.reason == 'canceled' && data.side == 'buy' && bidAllowed) ||
            (data.reason == 'filled' && data.side == 'sell' && remainingSize >= minimumSize)
    }
}

module.exports = {
    TraderBot,
    getTrader: () => {
        return trader ? trader : new TraderBot()
    }
}