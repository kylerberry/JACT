const tiMACD = require('technicalindicators').MACD
const HistoricDataProvider = require('../HistoricDataProvider')

const defaults = {
    values: [],
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
}

const MACD = () => {
    let macdInput = Object.assign({}, defaults, {
        values: Array.from(HistoricDataProvider.get().map(candle => candle[4]))
    })

    let macd = tiMACD.calculate(macdInput)
        .filter(value => value.histogram)

    let currValue = macd[macd.length - 1].histogram
    let lastValue = macd[macd.length - 2].histogram

    if (lastValue > 0 && currValue < 0) {
        return 'SHORT'
    } else if (lastValue < 0 && currValue > 0) {
        return 'LONG'
    }
    
    return null
}

module.exports = MACD