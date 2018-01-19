/*
TODO:

- ability to combine strategies?
- spot reversals, bearish vs bullish trends
- write trades to CSV
- look into arbitrage opportunities
*/
'use strict';
const app = require('express')()
const config = require('./lib/config')
const TradingBot = require('./lib/tradingbot')
const strategies = require('./lib/strategies')
const { gdax } = require('./lib/gdax')
const Account = require('./lib/account')

const server = app.listen(process.env.PORT, () => {
    console.log(">> Cryptobot running on port", server.address().port)

    gdax.getAccounts((err, res, data) => {
        let trader = new TradingBot({
            strategy: strategies[config.strategies[0]], //temporary until bot.alt is live
            account: new Account(data)
        })

        trader.startTrading({
            product: config.product,
            granularity: config.granularity
        })
    })
})