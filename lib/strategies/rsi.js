const tiRsi = require('technicalindicators').RSI
const HistoricDataProvider = require('../HistoricDataProvider')

const defaults = {
    values: [],
    period: 14
}

const RSI = () => {
    let rsiInput = Object.assign({}, defaults, { values: HistoricDataProvider.get().map(value => value[4])})
    let rsi = tiRsi.calculate(rsiInput)
        .filter(values => values)
    let currentRsi = rsi[rsi.length - 1]
    let lastRsi = rsi[rsi.length - 2]

    if (currentRsi < 30 && currentRsi > lastRsi) {
        return 'LONG'
    } else if (currentRsi > 70 && currentRsi < lastRsi) {
        return 'SHORT'
    }

    return null
}

module.exports = RSI
