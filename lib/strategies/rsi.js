const tiRsi = require('technicalindicators').RSI
const HistoricDataProvider = require('../HistoricDataProvider')

const defaults = {
    values: [],
    period: 14
}

const RSI = () => {
    let rsiInput = Object.assign({}, defaults, { values: HistoricDataProvider.get().map(value => value[4])})
    let multiplier = 1.15
    let rsi = tiRsi.calculate(rsiInput)
        .filter(values => values)
    let currentRsi = rsi[rsi.length - 1]
    if (currentRsi < 50) {
        return ((100 - currentRsi) * multiplier) / 100
    } else if (currentRsi > 50) {
        return (100 - (currentRsi * multiplier)) / 100
    }
}

module.exports = RSI
