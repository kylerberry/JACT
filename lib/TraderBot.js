const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s')
spinner.setSpinnerString(0);

const notifier = require('node-notifier');

// @todo maybe use 'match' event to manager.updatePosition() to split up logic
// @todo need better error handling and logging
// @todo orderPlaced is not always working
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
        this.canceledRetries = 0
        this.maxRetries = 1
    }

    /**
     * Let the trading begin!
     * Subscribe to feed data and init trading
     * 
     * @return void
     */
    startTrading() {
        console.log(`>> Trading ${this.options.product} every ${this.options.granularity} seconds with ${this.options.strategy} strategy.\n`)
        FeedService.subscribe('received', this.receivedHandler.bind(this))
        FeedService.subscribe('open', this.openHandler.bind(this))
        FeedService.subscribe('done', this.doneHandler.bind(this))
        this.trade()
    }

    /**
     * Execute a strategy with a historical dataset
     * @return void
     */
    trade() {
        spinner.stop(true)
        console.log(moment().utc().format('M/D HH:mm:ss UTC') + '\n')

        if (CandleProvider.hasData()) {
            HistoricDataProvider.append(CandleProvider.toArray())
        }

        let signal = this.strategy.signal()
        if (this.manager.shouldTriggerStop(CandleProvider.state().close)) {
            this.stopLosses()
        } else if (signal == 'LONG') {
            console.log('signal: LONG')
            this.longPosition()
        } else if (signal == 'SHORT') {
            console.log('signal: SHORT')
            this.shortPosition()
        } else {
            console.log('>> No further action.\n')
        }

        this.tradeInterval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
        spinner.start()
    }

    /**
     * Place a stop loss order
     * 
     * @return void
     */
    stopLosses() {
        this.placeOrder({
            side: 'sell',
            size: this.manager.getPosition().size,
            type: 'market',
            product_id: this.options.product
        })
        this.manager.closePosition()
    }

    /**
     * Open a position (buy)
     * 
     * @return void
     */
    longPosition() {
        if (this.manager.getOpenOrder()) {
            console.log(`>> Signal LONG, but there is an open order.\n`)
            return
        }

        if (this.manager.getPosition()) {
            console.log('>> Signal LONG but already long.\n')
            return
        }

        let params = {
            side: 'buy',
            size: this.manager.getOrderSize(CandleProvider.state().best_bid),
            price: CandleProvider.state().best_bid,
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
        }

        this.manager.openPosition(params)
        this.placeOrder(params)
    }

    /**
     * Close a position (sell)
     * 
     * @return void
     */
    shortPosition() {
        if (this.manager.getOpenOrder()) {
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
        this.manager.closePosition()
    }

    /**
     * Place an order
     * 
     * @param {Object} options
     * @return void
     */
    placeOrder(options = {}) {
        if (!options.side || !options.size) {
            console.log('=========DEBUG==========');
            console.log(`side: '${options.side}' and size: '${options.size}' are required.`)
            console.log(CandleProvider.state())
            console.log(this.manager.getPosition())
            console.log(this.manager.info())
            console.log('=========DEBUG==========\n');
            return
        }

        async function orderAsync(opts) {
            this.orderPlaced = true
            try {
                const data = await gdax[opts.side](opts).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
                if (data.status == 'rejected' && this.manager.getPosition()) {
                    // rejected LONG orders out of sync with position in the manager so cancel any open position
                    this.manager.cancelPosition()
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
     * Order Received
     * @param {*} data 
     */
    receivedHandler(data) {
        if (!this.orderPlaced) {
            return
        }
        spinner.stop(true)
        this.manager.addReceived(data)
        console.log(`>> #${data.order_id}: received.`)
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
        this.manager.addOpenOrder(data)
        console.log(`>> #${data.order_id}: open.`)
    }

    /**
     * Order has been completed from the books
     * Sent for all orders for which there was a received message
     * 
     * @todo canceled order retries should only retry once.
     * @todo partial fills should try until all the way filled
     * @param {*} data 
     */
    doneHandler(data) {
        if (!this.orderPlaced) {
            return
        }
        spinner.stop(true)

        let message = ''
        let remainingSize = parseFloat(data.remaining_size)
        let placeRemainderOrder = false

        if (data.reason == 'filled') {
            // size is not part of a filled order, only remaining_size. compare with last received
            data.size = parseFloat(this.manager.getLastReceived().size) - parseFloat(data.remaining_size)
            this.manager.updatePosition(data)
            this.manager.removeOpenOrder()
            this.manager.addFilled(data)
            this.orderPlaced = false

            message = `#${data.order_id}: `
            // if position wasn't filled completely, open another order to do so
            if (remainingSize !== 0) {
                message += ` Partial fill. ${remainingSize} remaining.\n`
                // placeRemainderOrder = true
            }
            message += `filled ${data.side} ${data.size} @ $${data.price}.\n`
        } else if (data.reason == 'canceled') {
            this.manager.removeOpenOrder()
            if (data.side == 'buy') { 
                this.manager.cancelPosition()
            }
            message = `#${data.order_id}: cancelled ${data.side} ${remainingSize} @ $${data.price}.\n`
            // try to place another sell order
            placeRemainderOrder = data.side == 'sell' && this.manager.getPosition()
        }

        if (placeRemainderOrder) {
            message += "Placing an immediate order to fill remaining size.\n"
            this.placeOrder({
                side: data.side,
                size: remainingSize,
                price: data.side == 'sell' ? CandleProvider.state().best_ask : CandleProvider.state().best_bid,
                post_only: true,
                time_in_force: 'GTT',
                cancel_after: 'min'
            })
        }

        // log and notify
        if (message) {
            console.log(`>> ${message}`)
            notifier.notify(message);
        }

        // show this after the other stuff
        if (data.side == 'sell' && remainingSize == 0 && data.reason == 'filled') {
            console.log(this.manager.info())
            console.log('\n')
        }
    }
}

module.exports = TraderBot