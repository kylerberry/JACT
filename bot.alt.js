/*
TODO:

- ability to combine strategies?
- spot reversals, bearish vs bullish trends
- write trades to CSV
- look into arbitrage opportunities
*/
'use strict';
const app = require('express')()
const options = require('./lib/cl-args')()
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

    async function getHistoricDataAsync(product, options) {
        try {
            return await CAREFUL_PRODUCTION_GDAX.getProductHistoricRates(product, options)
        } catch (err) {
            throw new Error(`>> Could not get historic data. Shutting down. ${err}`)
        }
    }

    const gdaxAccounts = getAccountsAsync()
    const historicData = getHistoricDataAsync(options.product, { granularity: options.granularity })

    const portfolio = new PortfolioManager(gdaxAccounts)
    const macdStrategy = new Strategy(historicData)
    const traderBot = new TradingBot({
        strategy: macdStrategy,
        portfolio: portfolio
    })

    traderBot.startTrading({
        product: options.product,
        granularity: options.granularity
    })
})