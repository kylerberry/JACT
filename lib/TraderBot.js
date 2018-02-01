const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const CandleProvider = require('./CandleProvider')
const HistoricDataProvider = require('./HistoricDataProvider')
const FeedService = require('./FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('waiting... %s')
spinner.setSpinnerString(0);

const notifier = require('node-notifier');

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
        if (this.manager.getPosition()) {
            console.log('>> Signal LONG but already long.')
            return
        }

        let params = {
            side: 'buy',
            size: this.manager.getOrderSize(CandleProvider.state().best_bid),
            price: CandleProvider.state().best_bid
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
        let position = this.manager.getPosition()
        if (!position) {
            console.log('>> Signal SHORT but nothing to short.')
            return
        }
        
        this.placeOrder({
            side: 'sell',
            size: position.size,
            price: CandleProvider.state().best_ask
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
            throw new Error('Order options `side` and `size` are required to place an order.')
        }
        if (this.manager.getOpenOrder()) {
            console.log(`>> Attempting to ${options.side}, but there is an open order.\n`)
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
            side: options.side,
            post_only: true,
            time_in_force: 'GTT',
            cancel_after: 'min'
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

        console.log(data)
        this.manager.addReceived(data)
        console.log(`>> #${data.order_id}: received.\n`)
    }

    /**
     * Order open on book
     * @param {*} data 
     */
    openHandler(data) {
        // The order is now open on the order book. This message will only be sent for orders which are not fully filled immediately.remaining_size will indicate how much of the order is unfilled and going on the book.
        if (!this.orderPlaced) {
            return
        }

        console.log(data)
        // if partially filled, there could be > 1 open order for every received
        this.manager.addOpenOrder(data)
        console.log(`>> #${data.order_id}: open.\n`)
    }

    /**
     * Order has been completed from the books
     * @param {*} data 
     */
    doneHandler(data) {
        // ** Sent for all orders for which there was a received message
        if (!this.orderPlaced) {
            return
        }

        console.log(data)
        let message = '';
        let remainingSize = parseFloat(data.remaining_size)

        if (data.reason == 'filled') {
            // size is not part of a filled order, only remaining_size. compare with last received
            data.size = parseFloat(this.manager.getLastReceived().size) - parseFloat(data.remaining_size)
            this.manager.updatePosition(data)
            this.manager.removeOpenOrder()
            this.manager.addFilled(data)
            this.orderPlaced = false

            // if position wasn't filled completely, open another order to do so
            if (remainingSize !== 0) {
                message = `#${data.order_id}: ${data.side} for ${data.size} @ $${data.price} partially filled ${data.remaining_size}.
                    Placing an immediate order to fill remaining size.\n`
                this.placeOrder({
                    side: data.side,
                    size: data.remaining_size,
                    price: data.side == 'sell' ? CandleProvider.state().best_ask : CandleProvider.state().best_bid
                })
            } else {
                message = `#${data.order_id}: ${data.side} for ${data.size} @ $${data.price} filled.\n`
                spinner.start()
            }
        } else if (data.reason == 'canceled') {
            this.manager.removeOpenOrder()
            message = `#${data.order_id}: cancelled. 
                Placing an immediate order to fill remaining size.\n`
            this.placeOrder({
                side: data.side,
                size: data.remaining_size,
                price: data.side == 'sell' ? CandleProvider.state().best_ask : CandleProvider.state().best_bid
            })
            
        }

        // log and notify
        if (message) {
            console.log(`>> ${message}`)
            console.log(this.manager.info())
            notifier.notify(message);
        }
        
    }
}

module.exports = TraderBot