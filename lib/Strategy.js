const moment = require('moment')
const strategies = require('./strategies')
const { append, get } = require('./HistoricDataProvider')
const pickBy = require('lodash/pickBy')
const reduce = require('lodash/reduce')
const size = require('lodash/size')

/**
 * Strategy
 */
class Strategy {
    constructor(options) {
        this.strategies = pickBy(strategies, (value, key) => {
            return options.strategies.indexOf(key) !== -1
        })
    }

    /**
     * calculates the signal for all included strategies
     * average of all signals
     * 
     * @return {Float}
     */
    signal(logValues = false) {
        return reduce(this.strategies, (acc, strategy, key) => {
            let signal = strategy()
            if (logValues) {
                console.log(`${key}: ${signal}`)
            }
            return acc + signal
        }, 0) / size(this.strategies)
    }
}

module.exports = Strategy