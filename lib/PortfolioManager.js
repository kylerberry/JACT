const pick = require('lodash/pick')
class PortfolioManager {
    constructor(accounts, options) {
        // get the product account
        this.account = pick(accounts, { product: options.product.split('-')[0]})
        this.options = options

        this.lastFilled = null
        this.openOrder = null
        this.completedTrades = []
    }

    /**
     * Calculates the net amount from completed trades
     */
    getNetMargin() {
        return this.completedTrades.reduce((acc, trade) => {
            if (trade.side == 'buy') {
                return acc - (trade.price * trade.size)
            } else {
                return acc + (trade.price * trade.size)
            }
        }, 0)
    }

    /**
     * Reflects the coin equity of the bot, not necessarily the entire account
     */
    getEquity() {

    }

    /**
     * Calculates the percentage gain from completed trades
     */
    getPercentMargin() {
        return this.getNetMargin() / this.getFundingAmount()
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
        // using 100% of available wallet sometimes fails "insufficient funds" because there's no overhead for the transaction fee
        let amount = this.account.available * .95
        return amount > this.options.maxFunds ? this.options.maxFunds : amount
    }

    /**
     * Set the most recently completed trade
     * 
     * @param {Object} data 
     */
    setLastFilled(data) {
        this.lastFilled = data
        this.completedTrades.unshift(this.lastFilled)
    }

    /**
     * Get the last completed trade
     */
    getLastFilled() {
        return this.lastFilled
    }

    /**
     * Set the most recently opened order
     * 
     * @param {Object} data 
     */
    setOpenOrder(id) {
        // this should be an order id
        this.openOrder = id
    }

    /**
     * Get the last open order
     */
    getOpenOrder() {
        return this.openOrder
    }
}

module.exports = PortfolioManager