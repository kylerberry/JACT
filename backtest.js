'use strict';
const app = require('express')()
const config = require('./lib/config')

const { gdax, DANGER_LIVE_GDAX_DANGER } = require('./lib/gdax')

const Strategy = require('./lib/Strategy')
const PortfolioManager = require('./lib/PortfolioManager')
const BacktestBot = require('./lib/BacktestBot')

const flatten = require('lodash/flatten')

const server = app.listen(process.env.PORT, () => {
    console.log(`>> JACT backtest running on port ${server.address().port}\n`)

    /**
     * Bootstraps the portfolio manager
     * @param {Object} options 
     * @return {Promise}
     */
    async function initPortfolioManagerAsync(options) {
        const accounts = await gdax.getAccounts()
            .catch(err => { throw new Error(err) })
            if (accounts.message) {
                throw new Error(accounts.message)
            }
        return new PortfolioManager(accounts, options)
    }

    /**
     * Bootstraps the TraderBot with the Strategy and PortfolioManager
     * @param {} options 
     * @return void
     */
    async function initBacktestBot(options) {
        try {
            console.log('>> Fetching account information.')
            const manager = await initPortfolioManagerAsync(options)

            const strategy = new Strategy(options)
            console.log('>> Strategy initialized.\n')

            const bot = new BacktestBot({
                strategy,
                manager,
                options
            })

            bot.startTrading()
        } catch (err) {
            console.log(`>> ${err}`)
            process.exit()
        }
    }

    initBacktestBot(config)
})