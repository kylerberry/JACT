const find = require('lodash/find')
const cloneDeep = require('lodash/cloneDeep')
const remove = require('lodash/remove')
const findLast = require('lodash/findLast')

/*

@TODO info calc is incorrect

>> #0b8a2a5e-571c-4f0b-84bc-043d9b0f5860 filled buy w/ remaining 0 LTC-USD @ $224.90000000.
{ lastTrade:
   { type: 'match',
     trade_id: 26093226,
     maker_order_id: '0b8a2a5e-571c-4f0b-84bc-043d9b0f5860',
     taker_order_id: '37da8780-0ec9-405a-aa6b-ce84f23b7708',
     side: 'buy',
     size: '0.44464206',
     price: '224.90000000',
     product_id: 'LTC-USD',
     maker_user_id: '59f09145a4451200c8b9397e',
     user_id: '59f09145a4451200c8b9397e',
     maker_profile_id: 'c14ebf8e-d2c8-4b66-8f4b-1406b14e3ad0',
     profile_id: 'c14ebf8e-d2c8-4b66-8f4b-1406b14e3ad0',
     sequence: 1625740329,
     time: '2018-02-19T15:24:05.911000Z' },
  totalTrades: 1,
  wins: 0,
  losses: 0,
  avgSlippage: undefined,
  avgWin: {},
  avgLoss: {},
  netProfit: { usd: '0.0000', percent: '0.0000' } }


2/19 17:08:06 UTC

>> Signal: SHORT
>> #41a273df-1dff-491c-9232-09dc472fe954: open.
>> #41a273df-1dff-491c-9232-09dc472fe954 filled sell w/ remaining 0 LTC-USD @ $222.51000000.
{ lastTrade:
   { type: 'match',
     trade_id: 26096796,
     maker_order_id: '41a273df-1dff-491c-9232-09dc472fe954',
     taker_order_id: '9e1b8f3c-4d1c-4091-99de-f92b57a6011b',
     side: 'sell',
     size: '0.44464206',
     price: '222.51000000',
     product_id: 'LTC-USD',
     maker_user_id: '59f09145a4451200c8b9397e',
     user_id: '59f09145a4451200c8b9397e',
     maker_profile_id: 'c14ebf8e-d2c8-4b66-8f4b-1406b14e3ad0',
     profile_id: 'c14ebf8e-d2c8-4b66-8f4b-1406b14e3ad0',
     sequence: 1625992242,
     time: '2018-02-19T17:08:08.029000Z' },
  totalTrades: 2,
  wins: 1,
  losses: 0,
  avgSlippage: undefined,
  avgWin: { usd: '1.0627', percent: '2.3900' },
  avgLoss: {},
  netProfit: { usd: '-1.0627', percent: '-0.0106' } }

 */
class PortfolioManager {
    constructor(accounts, options) {
        this.usdAccount = find(accounts, { currency: options.product.split('-')[1] })
        this.assetAcount = find(accounts, { currency: options.product.split('-')[0] })
        this.options = options

        this.open = []
        this.filled = []
    }

    /**
     * Add a filled order
     * @param {Object} data 
     * @return void
     */
    addFilled(data) {
        this.filled.push(data)
    }

    /**
     * get all the filled orders
     * @return {Array}
     */
    getFilled() {
        return cloneDeep(this.filled)
    }

    /**
     * get the last filled order
     * @return {Object}
     */
    getLastFilled() {
        return this.filled[this.filled.length - 1]
    }

    /**
     * get the last filled buy
     * @return {Object}
     */
    getLastBuy() {
        return findLast(this.filled, { side: 'buy' })
    }

    /**
     * get the current position size
     * @return {Number}
     */
    getCurrentRemainingPositionSize() {
        if (!this.filled.length) {
            return 0
        }

        let partials = 0
        for (let i = this.filled.length-1; i >= 0; i--) {
            if (this.filled[i].side == 'buy' && !partials) {
                return this.filled[i].size
            } else if (this.filled[i].side == 'buy' && partials) {
                return this.filled[i].size - partials
            } else {
                partials += this.filled[i].size
            }
        }
    }

    /**
     * Add an open order
     * 
     * @param {Object} data 
     */
    addOpen(data) {
        this.open.push(data)
    }

    /**
     * Get an open order by id or the last
     * 
     * @param {String} id 
     */
    getOpen(id) {
        if (!id) {
            return this.open[this.open.length - 1]
        }
        return find(this.open, {order_id: id})
    }

    /**
     * Remove an open order by ID
     * 
     * @param {String} id 
     */
    removeOpen(id) {
        if (!id) {
            this.open.pop()
        }
        remove(this.open, o => o.order_id == id)
    }

    /**
     * If passed price triggers a stop loss market sell
     * 
     * @param {Number} price 
     */
    shouldTriggerStop(price) {
        let lastBuy = this.getLastBuy()
        if (!this.getCurrentRemainingPositionSize()) {
            return false
        }

        return price <= (lastBuy.price - (this.options.stopLoss * lastBuy.price))
    }

    /**
     * takes a signal price and proposed price for next order and 
     * checks if within allowable slippage range
     * 
     * @param {Number} signalPrice
     * @param {Number} proposedPrice
     * @return {Boolean}
     */
    isBidAllowed(signalPrice, proposedPrice) {
        return proposedPrice <= signalPrice + (signalPrice * this.options.allowedSlippage)
    }

    /**
     * Get the net and percent profit of all trades
     * 
     * @return {Object}
     */
    getTotals() {
        let lastBuy = null
        let net = this.filled.reduce((acc, trade) => {
            if (trade.side == 'buy') {
                lastBuy = trade
                return acc
            } else {
                return acc += (trade.price * trade.size) - (lastBuy.price * lastBuy.size)
            }
        }, 0)

        lastBuy = null
        let percent = this.filled.reduce((acc, trade) => {
            if (trade.side == 'sell') {
                return acc += (trade.price / lastBuy.price) - 1
            } else {
                lastBuy = trade
                return acc
            }
        }, 0)
        return {
            usd: net.toFixed(4),
            percent: percent.toFixed(4)
        }
    }

    /**
     * Get the average of all losing trades
     */
    getAvgLoss() {
        let lastBuy = null
        let sizeAcc = 0
        let priceAcc = 0
        let numPartials = 0
        let losses = this.filled.reduce((acc, trade) => {
            if (trade.side == 'sell') {
                numPartials++
                priceAcc += (trade.price * trade.size)
                sizeAcc += trade.size
                if (sizeAcc == parseFloat(lastBuy.size)) {
                    priceAcc = priceAcc - (lastBuy.price * lastBuy.size)
                    if (priceAcc < 0) {
                        acc.push({ net: priceAcc, percent: priceAcc / lastBuy.size })
                    }
                }
                return acc
            } else {
                sizeAcc = priceAcc = numPartials = 0
                lastBuy = trade
                return acc
            }
        }, [])
        
        if (!losses.length) {
            return {}
        }

        return {
            usd: (losses.reduce((acc, loss) => acc += loss.net, 0) / losses.length).toFixed(4),
            percent: (losses.reduce((acc, loss) => acc += loss.percent, 0) / losses.length).toFixed(4)
        }
    }

    /**
     * Get the average of all winning trades
     */
    getAvgWin() {
        let lastBuy = null
        let sizeAcc = 0
        let priceAcc = 0
        let numPartials = 0
        let wins = this.filled.reduce((acc, trade) => {
            if (trade.side == 'sell') {
                numPartials++
                priceAcc += (trade.price * trade.size)
                sizeAcc += trade.size
                if (sizeAcc == parseFloat(lastBuy.size)) {
                    priceAcc = priceAcc - (lastBuy.price * lastBuy.size)
                    if (priceAcc >= 0) {
                        acc.push({ net: priceAcc, percent: priceAcc / lastBuy.size })
                    }
                }
                return acc
            } else {
                sizeAcc = priceAcc = numPartials = 0
                lastBuy = trade
                return acc
            }
        }, [])

        if (!wins.length) {
            return {}
        }

        return {
            usd: (wins.reduce((acc, win) => acc += win.net, 0) / wins.length).toFixed(4),
            percent: (wins.reduce((acc, win) => acc += win.percent, 0) / wins.length).toFixed(4)
        }
    }

    /**
     * Get completed win & loss counts
     * 
     * @return {Object}
     */
    getCompleted() {
        let priceAcc = 0
        let sizeAcc = 0
        let lastBuy = null
        let wins = 0
        let losses = 0
        let numPartials = 0
        this.filled.forEach(trade => {
            if (trade.side == 'sell') {
                numPartials++
                priceAcc += (trade.price * trade.size)
                sizeAcc += trade.size
                if (sizeAcc == parseFloat(lastBuy.size)) {
                    priceAcc = priceAcc - (lastBuy.price * lastBuy.size)
                    if (priceAcc >= 0) {
                        wins++
                    } else {
                        losses++
                    }
                }
            } else {
                sizeAcc = priceAcc = numPartials = 0
                lastBuy = trade
            }
        })
        return { wins, losses }
    }

    /**
     * Calculate the average slippage of all orders
     * 
     * @TODO figure out how to calculate this now that we have no buy signal price
     * @return {Number}
     */
    getAvgSlippage() {
        // let netAcc = null
        // let sizeAcc = null
        // let lastBuy = null
        // let avgSellPrice = null
        // let slippage = 0
        // let completed = 0
        // this.filled.forEach(trade => {
        //     if (trade.side == 'sell') {
        //         netAcc += (lastBuy.price * lastBuy.size) - (trade.price * trade.size)
        //         sizeAcc += trade.size
        //         if (sizeAcc == parseFloat(lastBuy.size)) {
        //             slippage += ((trade.price - lastBuy.price) / (lastBuy.price - lastBuy.signal_price) + (trade.signal_price - trade.price)) - 1
        //             completed++
        //         }
        //     } else {
        //         sizeAcc = netAcc = 0
        //         lastBuy = trade
        //     }
        // })
        // console.log(slippage)
        // return slippage / completed
        // let completed = this.completed
        // return completed.reduce((acc, position) => acc += position.slippage, 0) / completed.length
    }

    /**
     * State of the account
     * 
     * @return {Object}
     */
    info() {
        let completed = this.getCompleted()
        return {
            lastTrade: this.getLastFilled(),
            totalTrades: this.getFilled().length,
            wins: completed.wins,
            losses: completed.losses,
            avgSlippage: undefined,//this.getAvgSlippage().toFixed(4),
            avgWin: this.getAvgWin(),
            avgLoss: this.getAvgLoss(),
            netProfit: this.getTotals()
        }
    }

    /**
     * Gets the order size for the provided product based on available funding
     * 
     * @param {String} product | 'USD', 'LTC', 'BTC'
     * @param {Float} price
     */
    getOrderSize(price) {
        let fixedDecimalMax = 8
        return (this.getFundingAmount() / price).toFixed(fixedDecimalMax)
    }

    /**
     * Gets available funding from the provided product account
     * 
     * @param {String} product | 'USD', 'LTC', 'BTC'
     */
    getFundingAmount() {
        let amount = this.usdAccount.available
        return amount > this.options.maxFunds ? this.options.maxFunds : amount
    }
}

module.exports = PortfolioManager