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
const { gdax } = require('./lib/gdax')
const Account = require('./lib/account')

const server = app.listen(process.env.PORT, () => {
    console.log(">> Cryptobot running on port", server.address().port)

    gdax.getAccounts((err, res, data) => {
        let trader = new TradingBot({
            strategy: options.strategy,
            account: new Account(data)
        })

        trader.startTrading({
            product: options.product,
            granularity: options.granularity
        })
    })
})