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
const TradingBot = require('./lib/tradingbot')
const { gdax, CAREFUL_PRODUCTION_GDAX } = require('./lib/gdax')
const Account = require('./lib/account')

const server = app.listen(process.env.PORT, () => {
    console.log(">> Cryptobot running on port", server.address().port)

    // get Accounts
    async function getAccountsAsync() {
        try {
            return await gdax.getAccounts()
        } catch (err) {
            throw new Error(`>> Could not fetch accounts. Shutting down. #{err}`)
        }
    }

    async function getHistoricDataAsync(product, config) {
        try {
            return await CAREFUL_PRODUCTION_GDAX.getProductHistoricRates(product, config)
        } catch (err) {
            throw new Error(`>> Could not get historic data. Shutting down. ${err}`)
        }
    }

    const gdaxAccounts = getAccountsAsync()
    const historicData = getHistoricDataAsync(config.product, { granularity: config.granularity })

    const portfolio = new PortfolioManager(gdaxAccounts)
    const macdStrategy = new Strategy(historicData)
    const traderBot = new TradingBot({
        strategy: macdStrategy,
        portfolio: portfolio
    })

    traderBot.startTrading({
        product: config.product,
        granularity: config.granularity
    })
})