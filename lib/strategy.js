const ti = require('technicalindicators')
const MACD = ti.MACD

/** 
 * Create a MACD Strategy
 * 
 * @optionalParam values
 * @optionalParam fastPeriod
 * @optionalParam slowPeriod
 * @optionalParam signalPeriod
 * @optionalParam SimpleMAOscillator
 * @optionalParam SimpleMASignal
 * 
 * @return function
 */
const MACD = (options = {}) => {
    // return () => {
    //     let macd = MACD.calculate(options)
    //         .filter(value => value.histogram)

    //     const currValue = macd[macd.length - 1].histogram
    //     const lastValue = macd[macd.length - 2].histogram

    //     let decision = null
    //     if (lastValue > 0 && currValue < 0) {
    //         // sell
    //         decision = false
    //     } else if (lastValue < 0 && currValue > 0) {
    //         // buy
    //         decision = true
    //     }
    // }
}

module.exports = MACD