const stoch = require('technicalindicators').Stochastic
const sma = require('technicalindicators').SMA
const HistoricDataProvider = require('../HistoricDataProvider')
const cloneDeep = require('lodash/cloneDeep')

const defaults = {
    high: [],
    low: [],
    close: [],
    period: 14,
    signalPeriod: 3
}

const logger = (data) => {
    console.log(data)
}

const SlowStochastic = (showLog = false) => {
    let log = showLog ? logger : () => {}
    let stochInput = cloneDeep(defaults)
    let data = HistoricDataProvider.get()
    data.forEach(candle => {
        if (!candle) {
            return
        }
        stochInput.high.push(candle[2])
        stochInput.low.push(candle[1])
        stochInput.close.push(candle[4])
    })

    let kd = stoch.calculate(stochInput).filter(values => values.d && values.k)

    let smoothK = sma.calculate({ values: kd.map(input => input.k), period: 3 })
    let smoothD = sma.calculate({ values: smoothK.map(input => input), period: 3 })

    let currentK = smoothK[smoothK.length - 1]
    let currentD = smoothD[smoothD.length - 1]

    let lastK = smoothK[smoothK.length - 2]
    let lastD = smoothD[smoothD.length - 2]

    // console.log(`currK: ${currentK}`)
    // console.log(`prevK: ${lastK}`)
    // console.log(`currD: ${currentD}`)
    // console.log(`prevD: ${lastD}`)

    if (currentK > 50 && lastK <= 50) {
        return 'LONG'
    } else if (currentK < 50 && lastK >= 50) {
        return 'SHORT'
    }

    return null
}

module.exports = SlowStochastic
