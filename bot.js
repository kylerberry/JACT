/*
New architecture

@todo implement SlowStoch Strategy + MACD
MACD signal lines above the histogram then slowstoch buys crossover in oversold territory
or buy slowStoch crossover when oversold and RSI is < 50, sell on slowStoch crossunder oversold
*/
'use strict';
const app = require('express')()
const config = require('./lib/config')

const { gdax, DANGER_LIVE_GDAX_DANGER } = require('./lib/gdax')

const Strategy = require('./lib/strategies')[config.strategies[0]]
const PortfolioManager = require('./lib/PortfolioManager')
const TraderBot = require('./lib/TraderBot')

const server = app.listen(process.env.PORT, () => {
    console.log(`>> JACT running on port ${server.address().port}\n`)
    console.log(`>> Trading ${config.product} every ${config.granularity} seconds with ${config.strategies.join('+ ')} strategy.\n`)

    /**
     * Bootstraps the portfolio manager
     * @param {Object} options 
     * @return {Promise}
     */
    async function initPortfolioManagerAsync(options) {
        const accounts = await gdax.getAccounts()
            .catch(err => { throw new Error(err) })
        return new PortfolioManager(accounts, options)
    }

    /**
     * Bootstraps the Strategy
     * @param {Object} options 
     * @return {Promise}
     */
    async function initStrategyAsync(options) {
        const historicData = await DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(options.product, { granularity: options.granularity })
            .catch(err => { throw new Error(err) })
        return new Strategy(historicData, options)
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
                manager,
                options
            })

            bot.startTrading()
        } catch (err) {
            console.log(`>> ${err}`)
            process.exit()
        }
    }

    initTraderBotAsync(config)
})