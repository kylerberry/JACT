'use strict';
const app = require('express')()
const find = require('lodash/find')
const config = require('./lib/ConfigProvider')
const { gdax } = require('./lib/gdax')
const strategy = require('./lib/Strategy')()
const manager = require('./lib/PortfolioManager')
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
        manager.setAccount(find(accounts, { currency: options.product.split('-')[1] }))
    }

    /**
     * Bootstraps the TraderBot with the Strategy and PortfolioManager
     * @param {} options 
     * @return void
     */
    async function initBacktestBot(options) {
        try {
            console.log('>> Fetching account information.')
            await initPortfolioManagerAsync(options)

            strategy.set(options.strategy)
            console.log('>> Strategy initialized.\n')

            const bot = new BacktestBot()
            bot.startTrading()
        } catch (err) {
            console.log(`>> ${err}`)
            process.exit()
        }
    }

    initBacktestBot(config.get())
})