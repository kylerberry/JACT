const tiRsi = require('technicalindicators').RSI
const HistoricDataProvider = require('../HistoricDataProvider')

const defaults = {
    values: [],
    period: 14
}

const RSI = () => {
    let rsiInput = Object.assign({}, defaults, { values: HistoricDataProvider.get().map(value => value[4])})
    let multiplier = 1.2
    let rsi = tiRsi.calculate(rsiInput)
        .filter(values => values)
    let currentRsi = rsi[rsi.length - 1]

    // more linear signal
    let diff = Math.max(currentRsi, 50) - Math.min(currentRsi, 50)
    if (currentRsi < 50) {
        return ((diff + diff) / 100) + .5
    } else if (currentRsi >= 50) {
        return .5 - ((diff + diff) / 100)
    }
}

module.exports = RSI
