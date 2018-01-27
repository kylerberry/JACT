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
        FeedService.subscribe('match', this.matchHandler.bind(this))
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
        // this.buy()
        // if (signal == 'LONG') {
        //     this.buy()
        // } else if (signal == 'SHORT') {
        //     this.sell()
        // } else {
        //     console.log('>> No further action.\n')
        //     spinner.start()
        // }

        this.tradeInterval = setTimeout(this.trade.bind(this), this.options.granularity * 1000)
    }

    /**
     * Order Received
     * @param {*} data 
     */
    receivedHandler(data) {
        // dirty way to make sure the order was placed by the bot and not externally
        // let stopOrder = this.manager.getStopOrder()
        // if (this.orderPlaced || (stopOrder && stopOrder.id == data.order_id)) {
        //     if (stopOrder && stopOrder.id == data.order_id) {
        //         console.log(`>> Stop loss triggered.\n`)
        //     }
        //     console.log(`>> ${data.side.toUpperCase()} order placed for ${data.size} ${data.product_id} @ $${data.price}. #${data.order_id}\n`)
        //     // @todo this isn't always set in time before `match` tries to use. logs incorrect side
        //     this.manager.setOpenOrder(data)
        //     this.orderPlaced = false
        // }
        console.log(data)
    }

    /**
     * Order open on book
     * @param {*} data 
     */
    openHandler(data) {
        // The order is now open on the order book.This message will only be sent for orders which are not fully filled immediately.remaining_size will indicate how much of the order is unfilled and going on the book.
        // let openOrder = this.manager.getOpenOrder();
        // // if order size is different from the open order then it was partially filled
        // if (data.order_id == openOrder.order_id && data.remaining_size !== openOrder.size) {
        //     console.log(data)
        // }
        console.log(data)
    }

    /**
     * Trade has taken place
     * @param {*} data 
     */
    matchHandler(data) {
        console.log(data)
    }

    /**
     * Order has been removed from the books
     * @param {*} data 
     */
    doneHandler(data) {
        // if this is too slow I may need to poll a local orderbook
        // let open = this.manager.getOpenOrder()
        // if (open && open.order_id == data.order_id) {
        //     if (data.reason == 'filled') {
        //         // this has to be set immediately for manager.info to output data correctly
        //         this.manager.setLastFilled(open)
        //         // if we sell our position and there's an open stop order
        //         if (data.side == 'sell' && this.manager.getStopOrder()) {
        //             // cancel it
        //             this.cancelOrder(this.manager.getStopOrder())
        //             console.log(this.manager.info())
        //         } else if (data.side == 'buy') {
        //             this.placeStopLoss(open) // using open because it has size prop
        //         }
        //     }
        //     this.manager.setOpenOrder()
        //     console.log(`>> Order #${data.order_id} ${data.reason}.\n`)
        // }
        console.log(data)
    }

    /**
     * Stop order has been placed
     * @param {*} data 
     */
    activateHandler(data) {
        // this.manager.setStopOrder(data)
        // console.log(`>> Placed stop loss for ${data.size} ${data.product_id} @ ${data.price}.\n`)
        // spinner.start()
        console.log(data)
    }


    /**
     * Creates a stop order
     * 
     * //if stop loss get's hit, compare it to the id in the feed
     * //if orderToStop is sold before the stop loss, cancel the stop loss order
     * @param {Object} orderToStop 
     */
    placeStopLoss(orderToStop) {
        let stopPrice = orderToStop.price * (1 - this.options.stopLoss)

        async function buyAsync(options) {
            try {
                const data = await gdax.sell(options).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        buyAsync.call(this, {
            type: 'stop',
            price: stopPrice,
            size: orderToStop.size,
            product_id: this.options.product
        })
    }

    /**
     * Cancels an order
     * 
     * @param {Object} orderId 
     */
    cancelOrder(order) {
        let stopOrder = this.manager.getStopOrder()

        async function cancelAsync(orderId) {
            console.log(`>> Canceling ${order.type == 'active' ? 'STOP' : order.type} order #${orderId}.\n`)
            try {
                const data = await gdax.cancelOrder(orderId).catch(err => { throw new Error(err) })
                if (data.message) {
                    throw new Error(data.message)
                }
                //reset stop
                if (order.type == 'stop') {
                    this.manager.setStopOrder()
                }
                //if stop loss get's hit, compare it to the id in the feed
            } catch (err) {
                console.log(`>> ${err}\n`)
            }
        }

        cancelAsync.call(this, order.order_id || order.id)
    }

    /**
     * Buy
     */
    buy() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

        if (this.manager.getOpenOrder()) {
            console.log(">> Strategy signals buy, but there is an open order.\n")
            return
        }
        if (lastTrade && lastTrade.side == 'buy') {
            console.log(">> Strategy signals buy, but last trade was a 'buy'.\n")
            return
        }

        // use best_bid to make it more likely that our order will be bought quickly while still avoiding fees
        let orderShares = .1 //this.manager.getOrderSize(CandleProvider.get('best_bid'))

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
            price: 11368.34,//CandleProvider.get('best_bid'),
            size: orderShares,
            product_id: this.options.product,
            side: 'buy',
            post_only: true
        })
    }

    /**
     * Sell
     */
    sell() {
        let lastTrade = this.manager.getLastFilled()
        let now = moment()

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

        // manually cancel partially filled and open new order like gekko
        sellAsync.call(this, {
            type: 'limit',
            price: CandleProvider.get('best_ask'),
            size: orderShares,
            product_id: this.options.product,
            side: 'sell',
            post_only: true
        })
    }
 }

module.exports = TraderBot