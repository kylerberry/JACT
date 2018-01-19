const tiMACD = require('technicalindicators').MACD
const moment = require('moment')

/**
 * MACD Strategy
 */
class MACD {
    constructor(historicData, options) {
        this.historicData = historicData
        this.options = options
    }

    /**
     * Appends (unshifts) realtime data to historicData
     * @param {Array} data
     * @return {Array}
     */
    append(data) {
        this.historicData.unshift(data)
        this.historicData.pop()
        return this.historicData
    }

    /**
     * Creates input values based on historical close price for the MACD technical indicator
     * @return {Object}
     */
    createInput() {
        const defaults = {
            values: [],
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        }

        // candle => [ time, low, high, open, close, volume ]
        defaults.values = Array.from(this.historicData.map(candle => candle[4]))
        return defaults
    }

    /**
     * Signals buy/sell based on historic data
     * @return {Integer}
     */
    signal() {
        const buySignal = 1
        const sellSignal = 0
        const noSignal = -1

        // @todo maybe macd could look at 2 converging/diverging signal lines
        // to guess if a cross will happen to trigger signal a little sooner
            let macd = tiMACD.calculate(this.createInput())
            .filter(value => value.histogram)

        let currValue = macd[0].histogram
        let lastValue = macd[1].histogram

        if (lastValue > 0 && currValue < 0) {
            return sellSignal
        } else if (lastValue < 0 && currValue > 0) {
            return buySignal
        } else {
            return noSignal
        }
    }
}

module.exports = MACD