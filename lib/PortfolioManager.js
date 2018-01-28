const find = require('lodash/find')
class PortfolioManager {
    constructor(accounts, options) {
        this.usdAccount = find(accounts, { currency: options.product.split('-')[1] })
        this.coinAccount = find(accounts, { currency: options.product.split('-')[0] })
        this.options = options

        this.receivedOrders = []
        this.openOrder = null
        this.stopOrder = null
        this.filledOrders = []
    }

    addReceivedOrder(data) {
        this.receivedOrders.push(data)
    }

    getLastReceived() {
        return this.filledOrders[this.filledOrders.length - 1]
    }

    addFilledOrder(data) {
        this.filledOrders.push(data)
    }

    getLastFilled() {
        return this.filledOrders[this.filledOrders.length - 1]
    }

    addOpenOrder(data) {
        this.openOrder = data
    }

    getOpenOrder() {
        return this.openOrder
    }

    removeOpenOrder() {
        this.openOrder = null
    }

    addStopOrder(data) {
        this.stopOrder = data
    }

    getStopOrder() {
        return this.stopOrder
    }

    removeStopOrder() {
        this.stopOrders = null
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
     * State of the account
     */
    info() {
        return {
            lastFilled: this.getLastFilled(),
            netGain: this.getNetMargin(),
            percentGain: this.getPercentMargin()
        }
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
        let amount = this.usdAccount.available * .95
        return amount > this.options.maxFunds ? this.options.maxFunds : amount
    }
}

module.exports = PortfolioManager