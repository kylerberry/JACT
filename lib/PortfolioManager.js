const find = require('lodash/find')
const cloneDeep = require('lodash/cloneDeep')

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
        return cloneDeep(this.filled)
    }

    addReceived(data) {
        this.received.push(data)
    }

    getLastReceived() {
        return this.received[this.received.length - 1]
    }

    updatePosition(data) {
        if (!this.position) {
            return
        }
        if (this.position.side == 'sell') {
            this.position.size -= this.position.size_to_fill - data.remaining_size
            if (this.position.size == 0) {
                this.position = null
            }
        } else {
            let fillSize = this.position.size_to_fill - data.remaining_size
            this.position.size += fillSize
            this.position.price = this.position.price + (fillSize * data.price) / this.position.size
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

    cancelPosition() {
        this.position = null
    }

    getPosition() {
        return cloneDeep(this.position)
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

    getAvgs() {
        let filled = this.getFilled()
        let buys = filled.filter(trade => trade.side == 'buy')
        let sells = filled.filter(trade => trade.side == 'sell')

        let combinedBuys = []
        let combinedSells = []
        let temp = 0
        let combinedSize = 0

        // get buy averages
        buys.forEach(buy => {
            let size = parseFloat(buy.size)
            let price = parseFloat(buy.price)
            temp += price * size
            combinedSize += parseFloat(size)
            if (parseFloat(buy.remaining_size) == 0) {
                if (combinedSize == size) {
                    combinedBuys.push(temp)
                } else {
                    combinedBuys.push(temp / combinedSize)
                }
                temp = 0
                combinedSize = 0
            }
        })

        // get sell averages
        sells.forEach(sell => {
            let size = parseFloat(sell.size)
            let price = parseFloat(sell.price)
            temp += price * size
            combinedSize += parseFloat(size)
            if (parseFloat(sell.remaining_size) == 0) {
                if (combinedSize == size) {
                    combinedSells.push(temp)
                } else {
                    combinedSells.push(temp / combinedSize)
                }
                temp = 0
                combinedSize = 0
            }
        })

        return {
            sells: combinedSells, buys: combinedBuys
        }
    }

    /**
     * Gets the average price of winning trades
     * 
     * @return {Integer}
     */
    getAvgWin() {
        let avg = this.getAvgs()

        // get total win avg
        let tradeGains = []
        avg.sells.forEach(sellAvg => {
            avg.buys.forEach(buyAvg => {
                if (sellAvg > buyAvg) {
                    tradeGains.push(sellAvg - buyAvg)
                }
            })
        })

        return (tradeGains.reduce((acc, gain) => acc + gain, 0) / tradeGains.length) || 0
    }

    /**
     * Gets the average price of losing trades
     * 
     * @return {Integer}
     */
    getAvgLoss() {
        let avg = this.getAvgs()
        let tradeLosses = []
        avg.sells.forEach(sellAvg => {
            avg.buys.forEach(buyAvg => {
                if (sellAvg < buyAvg) {
                    tradeLosses.push(buyAvg - sellAvg)
                }
            })
        })

        return (tradeLosses.reduce((acc, gain) => acc + gain, 0) / tradeLosses.length) || 0
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
            avgWin: {
                usd: this.getAvgWin(),
            },
            avgLoss: {
                usd: this.getAvgLoss(),
            },
            netProfit: {
                usd: this.getNetMargin(),
                percent: this.getPercentMargin()
            }
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