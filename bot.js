/*
New architecture

@todo implement SlowStoch Strategy + MACD
MACD signal lines above the histogram then slowstoch buys crossover in oversold territory
or buy slowStoch crossover when oversold and RSI is < 50, sell on slowStoch crossunder oversold
*/
'use strict';
const app = require('express')()
const config = require('./lib/config')
const HistoricDataProvider = require('./lib/HistoricDataProvider')

const { gdax, DANGER_LIVE_GDAX_DANGER } = require('./lib/gdax')

const Strategy = require('./lib/Strategy')
const PortfolioManager = require('./lib/PortfolioManager')
const TraderBot = require('./lib/TraderBot')
const FeedService = require('./lib/FeedService')

let Spinner = require('cli-spinner').Spinner
let spinner = new Spinner('working... %s')
spinner.setSpinnerString(0);

const server = app.listen(process.env.PORT, () => {
    console.log(`>> JACT running on port ${server.address().port}\n`)

    try {
        let strategy = new Strategy(config)
    } catch (err) {
        console.log(`>> ${err}`)
    }
    

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
     * Bootstraps the Data Provider
     * @param {Object} options 
     * @return {Promise}
     */
    async function initHistoricDataAsync(options) {
        const data = await DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(options.product, { granularity: options.granularity })
            .catch(err => { throw new Error(err) })
            if (data.message) {
                throw new Error(data.message)
            }
            HistoricDataProvider.connect(data)
    }

    /**
     * Bootstraps the TraderBot with the Strategy and PortfolioManager
     * @param {} options 
     * @return void
     */
    async function initTraderBotAsync(options) {
        try {
            console.log('>> Fetching account information.')
            spinner.start()
            const manager = await initPortfolioManagerAsync(options)
            spinner.stop(true)

            console.log('>> Fetching historical data.')
            spinner.start()
            await initHistoricDataAsync(options)
            spinner.stop(true)
            
            console.log('>> Connecting to realtime feed. This may take a few moments.')
            spinner.start()
            await FeedService.connect().catch(err => { throw new Error(err) })
            spinner.stop(true)

            let strategy = new Strategy(options)
            console.log('>> Strategy initialized.\n')

            const bot = new TraderBot({
                strategy,
                manager,
                options
            })

            bot.startTrading()
        } catch (err) {
            spinner.stop(true)
            console.log(`>> ${err}`)
            process.exit()
        }
    }

    initTraderBotAsync(config)
})