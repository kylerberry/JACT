const moment = require('moment')
const strategies = require('./strategies')
const { append, get } = require('./HistoricDataProvider')
const pickBy = require('lodash/pickBy')
const toArray = require('lodash/toArray')

/**
 * Strategy
 */
class Strategy {
    constructor(options) {
        this.strategies = toArray(pickBy(strategies, (value, key) => {
            return options.strategies.indexOf(key) !== -1
        }))
    }

    /**
     * calculates the signal for all included strategies
     * average of all signals
     * 
     * @return {Float}
     */
    signal() {
        return this.strategies.reduce((acc, strategy) => {
            return acc + strategy()
        }, 0) / this.strategies.length
    }
}

module.exports = Strategy