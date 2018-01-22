const stoch = require('technicalindicators').Stochastic
const sma = require('technicalindicators').SMA
const moment = require('moment')

/**
 * MACD Strategy
 */
class SlowStochastic {
    constructor(historicData, options) {
        //technical indicator needs date asc
        this.historicData = historicData.reverse()
        this.options = options
    }

    /**
     * Appends (unshifts) realtime data to historicData
     * @param {Array} data
     * @return {Array}
     */
    append(data) {
        this.historicData.push(data)
        this.historicData.shift()
        return this.historicData
    }

    /**
     * Creates input values based on historical close price for the MACD technical indicator
     * @return {Object}
     */
    createInput() {
        const defaults = {
            high: [],
            low: [],
            close: [],
            period: 14,
            signalPeriod: 3
        }

        // candle => [ time, low, high, open, close, volume ]
        this.historicData.forEach(candle => {
            defaults.high.push(candle[2])
            defaults.low.push(candle[1])
            defaults.close.push(candle[4])
        })

        return defaults
    }

    /**
     * Signals buy/sell based on historic data
     * 
     * @todo calculate better signal values based on convergence/divergence. Not just crossover.
     * e.g. (converging kd but no cross might return a value of .657) it's on the bullish side of noSignal.
     * for use in conjunction with other indicators in the future (vol oscillator or macd)
     * @return {Integer}
     */
    signal() {
        const buySignal = 1
        const sellSignal = 0
        const noSignal = .5

        let kd = stoch.calculate(this.createInput()).filter(values => values.d && values.k)

        let smoothK = sma.calculate({ values: kd.map(input => input.k), period: 3})
        let smoothD = sma.calculate({ values: kd.map(input => input.d), period: 3})
        let smoothStoch = []

        let currentK = smoothK[smoothK.length - 1]
        let currentD = smoothD[smoothD.length - 1]
        
        // not ideal because we could miss some price action. use with BB
        if (currentK > currentD && currentK < 20) {
            return buySignal
        } else if(currentK < currentD && currentK > 80) {
            return sellSignal
        } else {
            return noSignal
        }
    }
}

module.exports = SlowStochastic
