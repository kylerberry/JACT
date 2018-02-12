const find = require('lodash/find')
const cloneDeep = require('lodash/cloneDeep')
const remove = require('lodash/remove')

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
     * Update a position props
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
            let remainingSize = this.position.size - size
            this.position.sell_price += price * size
            this.position.remaining_size = remainingSize
            if (remainingSize == 0) {
                this.position.sell_price = this.position.sell_price / this.position.size
                this.completePosition()
                return
            }
            this.position.sell_price = this.position.sell_price / (this.position.size - remainingSize)
        }
    }

    /**
     * Open a position, a long order has been placed
     */
    openPosition(data) {
        this.position = {
            size: data.size,
            remaining_size: data.size,
            signal_buy_price: data.price,
            buy_price: data.price, // @todo could change if adjusted long orders become allowed
            signal_sell_price: null,
            sell_price: 0,
            net: 0,
            percent: 0,
            slippage: 0
        }
    }

    /**
     * Calculate final percentages and append to the filled positions
     * then reset the position
     */
    completePosition() {
        let net = ((this.position.sell_price * this.position.size) - (this.position.buy_price * this.position.size))
        this.position.net = this.options.backtest.slippage ? net - (net * this.options.backtest.slippage) : net
        this.position.percent = (this.position.sell_price / this.position.buy_price) - 1
        this.position.slippage = this.options.backtest.slippage ?
            this.options.backtest.slippage :
            ((this.position.signal_sell_price / this.position.signal_buy_price) - 1) - this.position.percent
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
     * Get the totals of the completed positions
     */
    getTotals() {
        return {
            usd: this.completed.reduce((acc, position) => acc += position.net, 0),
            percent: this.completed.reduce((acc, position) => acc += position.percent, 0),
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
            usd: losses.reduce((acc, position) => acc += position.net, 0) / losses.length,
            percent: losses.reduce((acc, position) => acc += position.percent , 0) / losses.length
        }
    }

    /**
     * Get the average of all winning trades
     */
    getAvgWin() {
        let wins = this.completed.filter(position => position.net > 0)
        if (!wins.length) {
            return {}
        }
        return {
            usd: wins.reduce((acc, position) => acc += position.net, 0) / wins.length,
            percent: wins.reduce((acc, position) => acc += position.percent, 0) / wins.length
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
     * @todo add more stats
     * @return {Object}
     */
    info() {
        return {
            currentPosition: this.getPosition(),
            totalTrades: this.getFilled().length,
            avgSlippage: this.getAvgSlippage(),
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