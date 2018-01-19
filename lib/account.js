const find = require('lodash/find')

class Account {
    constructor(accounts) {
        this.accounts = accounts

        this.maxFunds = 1000 // max allowed funding hard-coded
        this.lastTrade = null
        this.openOrder = null
        this.completedTrades = [] // list of completed trades
    }

    /**
     * Internally used to get the account info for a product
     * 
     * @param {String} product | 'USD', 'LTC', 'BTC'
     */
    _getAccount(product) {
        return find(this.accounts, {currency: product})
    }

    /**
     * Returns info about the current profile manager: net profit, completed trades, etc
     */
    info() {
        return {
            time: new Date(),
            lastTrade: this.lastTrade,
            netMargin: this._getNetMargin(),
            percentMargin: this._getNetMargin().toFixed(2),
        }
    }

    /**
     * Calculates the net amount from completed trades
     */
    _getNetMargin() {
        return this.completedTrades.reduce((acc, trade) => {
            if (trade.side == 'buy') {
                return acc - (trade.price * trade.size)
            } else {
                return acc + (trade.price * trade.size)
            }
        }, 0)
    }

    /**
     * Calculates the percentage gain from completed trades
     */
    _getPercentMargin() {
        return this._getNetMargin() / this.getFundingAmount(this.lastTrade.product_id.split('-')[0])
    }

    /**
     * Gets available funding from the provided product account
     * 
     * @param {String} product | 'USD', 'LTC', 'BTC'
     */
    getFundingAmount(product) {
        // using 100% of available wallet sometimes fails "insufficient funds" because there's no overhead for the transaction fee
        let amount = this._getAccount(product).available * .95
        // multiplying maxfunds by a percentage to avoid a fee pushing the price of the trade above the wallet amount
        return amount > this.maxFunds ? this.maxFunds : amount
    }

    /**
     * Gets the order size for the provided product based on available funding
     * 
     * @param {String} product | 'USD', 'LTC', 'BTC'
     * @param {Float} price 
     */
    getOrderSize(product, price) {
        let fixedDecimalMax = 8
        return (this.getFundingAmount(product) / price).toFixed(fixedDecimalMax)
    }

    /**
     * Set the most recently completed trade
     * 
     * @param {Object} data 
     */
    setLastTrade(data = null) {
        this.lastTrade = data
        this.completedTrades.push(this.lastTrade)
    }

    /**
     * Get the last completed trade
     */
    getLastTrade() {
        return this.lastTrade
    }

    /**
     * Set the most recently opened order
     * 
     * @param {Object} data 
     */
    setOpenOrder(data = null) {
        this.openOrder = data
    }

    /**
     * Get the last open order
     */
    getOpenOrder() {
        return this.openOrder
    }
}

module.exports = Account