const fs = require('fs');

const stratRelPath = './strategies'
const stratRootPath = './lib/strategies'

/**
 * Strategy
 */
class Strategy {
    constructor(options) {
        let dotjs = options.strategy.indexOf('.js') == -1 ? '.js' : ''
        if (options.strategy && fs.existsSync(`${stratRootPath}/${options.strategy}${dotjs}`)) {
            this.strategy = require(`${stratRelPath}/${options.strategy}${dotjs}`)
        }

        if (!this.strategy) {
            throw new Error(`Could not find strategy '${options.strategy || options.strategy}'.`)
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