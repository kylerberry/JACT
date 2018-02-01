const stoch = require('technicalindicators').Stochastic
const sma = require('technicalindicators').SMA
const HistoricDataProvider = require('../HistoricDataProvider')

const defaults = {
    high: [],
    low: [],
    close: [],
    period: 14,
    signalPeriod: 3
}

const SlowStochastic = () => {
    let stochInput = Object.assign({}, defaults)
    HistoricDataProvider.get().forEach(candle => {
        stochInput.high.push(candle[2])
        stochInput.low.push(candle[1])
        stochInput.close.push(candle[4])
    })

    let kd = stoch.calculate(stochInput).filter(values => values.d && values.k)

    let smoothK = sma.calculate({ values: kd.map(input => input.k), period: 3 })
    let smoothD = sma.calculate({ values: kd.map(input => input.d), period: 3 })
    let smoothStoch = []

    let currentK = smoothK[smoothK.length - 1]
    let currentD = smoothD[smoothD.length - 1]

    let lastK = smoothK[smoothK.length - 2]
    let lastD = smoothD[smoothD.length - 2]

    console.log({
        currentK,
        currentD
    })
    console.log({
        lastK,
        lastD
    })

    if (currentK > currentD && lastK < lastD && currentK < 20) {
        return 'LONG'
    } else if (currentK < currentD && lastK > lastD && currentK > 80) {
        return 'SHORT'
    }

    return null
}

module.exports = SlowStochastic
