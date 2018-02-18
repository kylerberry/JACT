const find = require('lodash/find')
const cloneDeep = require('lodash/cloneDeep')
const remove = require('lodash/remove')

let positionDefaults = {
    size: null,
    remaining_size: null,
    signal_buy_price: null,
    buy_price: null,
    signal_sell_price: null,
    sell_price: null,
    net: null,
    percent: null,
    slippage: null
}
// @TODO a lot of partial sell orders messed up the position numbers. investigate
class PortfolioManager {
    constructor(accounts, options) {
        this.usdAccount = find(accounts, { currency: options.product.split('-')[1] })
        this.assetAcount = find(accounts, { currency: options.product.split('-')[0] })
        this.options = options

        this.position = null
        this.completed = []
        this.open = []
        this.filled = []
    }

    addFilled(data) {
        this.filled.push(data)
    }

    getFilled() {
        return cloneDeep(this.filled)
    }

    /**
     * made async because unsure if match events were coming faster than the ability to process them
     * 
     * @param {Object} data 
     * @return {Promise}
     */
    async updatePositionAsync(data) {
        return new Promise((resolve, reject) => {
            this.updatePosition(data)
            resolve({ message: 'updated' })
        })
    }

    /**
     * Update Position props on match
     * 
     * @param {Object} data 
     */
    updatePosition(data) {
        let size = parseFloat(data.size)
        let price = parseFloat(data.price)
        
        if (data.side == 'sell') {
            if (!this.position.signal_sell_price) {
                this.position.signal_sell_price = price
            }

            this.position.side = data.side
            this.position.remaining_size = parseFloat(this.position.size) - size
            this.position.sell_price += price * size

            if (this.position.remaining_size == 0) {
                this.completePosition()
            }
        } else {
            if (!this.position) {
                this.openPosition(data)
            }
            if (!this.position.signal_buy_price) {
                this.position.signal_buy_price = price
            }
            this.position.side = data.side
            this.position.remaining_size = 0
            this.position.buy_price = price
            this.position.size = size
        }
    }

    /**
     * Open a position, a long order has been placed
     */
    openPosition(data) {
        this.position = cloneDeep(positionDefaults)
    }

    /**
     * Calculate final percentages and append to the filled positions
     * then reset the position
     * 
     * @TODO re-run these numbers on last log. They got really thrown off somehow
     * @return void
     */
    completePosition() {
        this.position.sell_price = this.position.sell_price / this.position.size
        this.position.net = ((this.position.sell_price * this.position.size) - (this.position.buy_price * this.position.size))
        this.position.percent = (this.position.sell_price / this.position.buy_price) - 1
        this.position.slippage = (((this.position.signal_sell_price / this.position.signal_buy_price) - 1) - this.position.percent) || 0
        this.completed.push(this.position)
        // @TODO fetch this from gdax again
        // update the account amount after complete positions
        this.usdAccount.currency += this.position.net
        this.resetPosition()
    }

    /**
     * Reset position stats
     */
    resetPosition() {
        this.position = null
    }

    /**
     * Get the current position
     */
    getPosition() {
        return cloneDeep(this.position)
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
        if (!this.position) {
            return false
        }

        return price <= (this.position.buy_price - (this.options.stopLoss * this.position.buy_price))
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
     * Get the totals of the completed positions
     */
    getTotals() {
        return {
            usd: this.completed.reduce((acc, position) => acc += position.net, 0).toFixed(4),
            percent: this.completed.reduce((acc, position) => acc += position.percent, 0).toFixed(4),
        }
    }

    /**
     * Get the average of all losing trades
     */
    getAvgLoss() {
        let losses = this.completed.filter(position => position.net < 0)
        if (!losses.length) {
            return {}
        }
        return {
            usd: (losses.reduce((acc, position) => acc += position.net, 0) / losses.length).toFixed(4),
            percent: (losses.reduce((acc, position) => acc += position.percent , 0) / losses.length).toFixed(4)
        }
    }

    /**
     * Get the average of all winning trades
     */
    getAvgWin() {
        let wins = this.completed.filter(position => position.net >= 0)
        if (!wins.length) {
            return {}
        }
        return {
            usd: (wins.reduce((acc, position) => acc += position.net, 0) / wins.length).toFixed(4),
            percent: (wins.reduce((acc, position) => acc += position.percent, 0) / wins.length).toFixed(4)
        }
    }

    /**
     * Calculate the average slippage of all orders
     */
    getAvgSlippage() {
        let completed = this.completed
        return completed.reduce((acc, position) => acc += position.slippage, 0) / completed.length
    }

    /**
     * State of the account
     * 
     * @return {Object}
     */
    info() {
        return {
            currentPosition: this.getPosition(),
            totalTrades: this.getFilled().length,
            wins: this.completed.filter(position => position.net >= 0).length,
            losses: this.completed.filter(position => position.net < 0).length,
            avgSlippage: this.getAvgSlippage().toFixed(4),
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