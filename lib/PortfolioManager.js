const find = require('lodash/find')

// @todo make this.position a class/constructor
class PortfolioManager {
    constructor(accounts, options) {
        this.usdAccount = find(accounts, { currency: options.product.split('-')[1] })
        this.assetAcount = find(accounts, { currency: options.product.split('-')[0] })
        this.options = options

        this.position = null
        this.openOrder = null
        this.filled = []
        this.received = []
    }

    addFilled(data) {
        this.filled.push(data)
    }

    getFilled() {
        return this.filled
    }

    addReceived(data) {
        this.received.push(data)
    }

    getLastReceived() {
        return this.received[this.received.length - 1]
    }

    updatePosition(data) {
        if (this.position.side == 'sell') {
            this.position.size -= this.position.size_to_fill - data.remaining_size
            if (this.position.size == 0) {
                this.position = null
            }
        } else {
            let fillSize = this.position.size_to_fill - data.remaining_size
            this.position.size += fillSize
            this.position.price = this.position.price + (fillSize * data.price)/ this.position.size
        }
    }

    openPosition(orderParams) {
        this.position = {
            size_to_fill: orderParams.size,
            size: 0,
            price: 0,
            side: orderParams.side || 'buy'
        }
    }

    closePosition() {
        this.position.size_to_fill = this.position.size
        this.position.side = 'sell'
    }

    getPosition() {
        return this.position
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

    shouldTriggerStop(price) {
        // if sell order side then we are already in progress on selling
        if (!this.position || this.position.side == 'sell') {
            return false
        }

        return price <= (this.position.price - (this.options.stopLoss * this.position.price))
    }

    /**
     * Calculates the net amount from filled trades
     */
    getNetMargin() {
        return this.getFilled().reduce((acc, trade) => {
            if (trade.side == 'buy') {
                return acc - (trade.price * trade.size)
            } else {
                return acc + (trade.price * trade.size)
            }
        }, 0)
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
            netProfit: {
                usd: this.getNetMargin(),
                percent: this.getPercentMargin()
            },
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