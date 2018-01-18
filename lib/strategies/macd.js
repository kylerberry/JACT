const tiMACD = require('technicalindicators').MACD
const chart = require('../chart')
const drawInIterm = require('iterm2-image')
const moment = require('moment')

const mockData = {
    sell: [-1, 1],
    buy: [1, -1],
    wait: [-1, -1]
}

let executions = 0

/** 
 * Create a MACD Strategy
 * 
 * @param {Object} options
 * @requiredParam values
 * @optionalParam fastPeriod
 * @optionalParam slowPeriod
 * @optionalParam signalPeriod
 * @optionalParam SimpleMAOscillator
 * @optionalParam SimpleMASignal
 * 
 * @return function
 */
const MACD = (options = {}) => {
    const defaults = {
        values: [],
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    }

    if (typeof options.values == 'undefined') {
        throw new Error('>> Strategy Error: options.values must not be undefined.')
    }

    // create a new instance because shared reference was creating weird outcomes
    options.values = Array.from(options.values)

    // data is always time desc
    options.values = options.values.reverse().map((candle) => {
        return candle[4] // close
    })

    const macdInput = Object.assign({}, defaults, options)

    return {

        /**
         * receives callbacks to perform on the 3 recommendations
         */
        execute: (actions = {}) => {
            let macd = tiMACD.calculate(macdInput)
                .filter(value => value.histogram)

            let currValue = macd[macd.length - 1].histogram
            let lastValue = macd[macd.length - 2].histogram

            // @test creates a buy followed by a sell
            // if (executions <= 0) {
            //     currValue = mockData.buy[0]
            //     lastValue = mockData.buy[1]
            // } else {
            //     currValue = mockData.sell[0]
            //     lastValue = mockData.sell[1]
            // }
            // executions++

            if (lastValue > 0 && currValue < 0) {
                actions.sell()
            } else if (lastValue < 0 && currValue > 0) {
                actions.buy()
            } else {
                actions.wait()
            }
        }
    }
}

module.exports = MACD