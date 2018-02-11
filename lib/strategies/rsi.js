const tiRsi = require('technicalindicators').RSI
const HistoricDataProvider = require('../HistoricDataProvider')
const cloneDeep = require('lodash/cloneDeep')

const defaults = {
    values: [],
    period: 14
}

module.exports = () => {
    let rsiInput = cloneDeep(defaults)
    HistoricDataProvider.get().forEach(candle => {
        rsiInput.values.push(candle[4])
    })

    let rsi = tiRsi.calculate(rsiInput)
        .filter(values => values)
    let currentRsi = rsi[rsi.length - 1]
    let lastRsi = rsi[rsi.length - 2]

    if (currentRsi < 30 && currentRsi > lastRsi) {
        return 'LONG'
    } else if (currentRsi > 70 && currentRsi < lastRsi) {
        return 'SHORT'
    }
}