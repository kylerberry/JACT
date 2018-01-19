/*
New architecture

TODO:
- ability to combine strategies?
- spot reversals, bearish vs bullish trends
- write trades to CSV
*/
'use strict';
const app = require('express')()
const config = require('./lib/config')

const { gdax, DANGER_LIVE_GDAX_DANGER } = require('./lib/gdax')

// @todo will change later after deprecating other architecture
// const Strategy = require('./lib/strategies')[config.strategies[0]]
const Strategy = require('./lib/strategies/MACD')
const PortfolioManager = require('./lib/PortfolioManager')
const TraderBot = require('./lib/TraderBot')

const server = app.listen(process.env.PORT, () => {
    console.log(">> Cryptobot running on port", server.address().port)

    /**
     * Bootstraps the portfolio manager
     * @param {Object} options 
     * @return {Promise}
     */
    async function initPortfolioManagerAsync(options) {
        try {
            const accounts = await gdax.getAccounts()
            return new PortfolioManager(accounts, options)
        } catch (err) {
            throw new Error(`>> Could not fetch accounts. Shutting down. #{err}`)
            process.exit()
        }
    }

    /**
     * Bootstraps the Strategy
     * @param {Object} options 
     * @return {Promise}
     */
    async function initStrategyAsync(options) {
        try {
            const historicData = await DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(options.product, { granularity: options.granularity })
            return new Strategy(historicData, options)
        } catch (err) {
            throw new Error(`>> Could not get historic data. Shutting down. ${err}`)
            process.exit()
        }
    }

    /**
     * Bootstraps the TraderBot with the Strategy and PortfolioManager
     * @param {} options 
     * @return void
     */
    async function initTraderBotAsync(options) {
        try {
            const manager = await initPortfolioManagerAsync(options)
            const strategy = await initStrategyAsync(options)

            const bot = new TraderBot({
                strategy,
                manager
            })

            bot.startTrading()
        } catch (err) {
            throw new Error(`>> Could not get historic data. Shutting down. ${err}`)
            process.exit()
        }
    }

    initTraderBotAsync(config)
})