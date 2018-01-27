const strategies = require('./strategies')
const fs = require('fs');

/**
 * Strategy
 */
class Strategy {
    constructor(options) {
        if (fs.existsSync(options.strategy)) {
            // fetch strategy from filepath
        } else {
            this.strategy = strategies[options.strategy]
            if (!this.strategy) {
                throw new Error('Not a valid strategy')
            }
        }
    }

    /**
     * return the signal based on the strategy
     * 
     * @return {Float}
     */
    signal() {
        return this.strategy()
    }
}

module.exports = Strategy