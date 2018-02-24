'use strict';
const app = require('express')()
const find = require('lodash/find')
const config = require('./lib/ConfigProvider')
const HistoricDataProvider = require('./lib/HistoricDataProvider')
const { gdax } = require('./lib/gdax')
const strategy = require('./lib/Strategy')()
const manager = require('./lib/PortfolioManager')
const { getTrader, TraderBot } = require('./lib/TraderBot')
const FeedService = require('./lib/FeedService')
const configRoute = require('./api/routes/config');

// connect routes
app.use('/config', configRoute);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function (err, req, res, next) {
	// render the error message
	res.status(err.status || 500);
	res.json({ error: err.message });
});

const server = app.listen(process.env.PORT, () => {
    console.log(`>> JACT running on port ${server.address().port}\n`)

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

        // return usd account only
        manager.setAccount(find(accounts, { currency: options.product.split('-')[1] }))
    }

    /**
     * Bootstraps the Data Provider
     * @param {Object} options
     * @return {Promise}
     */
    async function initHistoricDataAsync(options) {
        const data = await gdax.getProductHistoricRates(options.product, { granularity: options.granularity })
            .catch(err => { throw new Error(err) })
		if (data.message) {
			throw new Error(data.message)
		}
		HistoricDataProvider.connect(data)
    }

    /**
     * Bootstraps the TraderBot with the Strategy and PortfolioManager
     * @param {Object} options
     * @return void
     */
    async function initTraderBotAsync(options) {
        try {
            console.log('>> Fetching account information.')
            await initPortfolioManagerAsync(options)

            console.log('>> Fetching historical data.')
            await initHistoricDataAsync(options)

            console.log('>> Connecting to realtime feed. This may take a few moments.')
            await FeedService.connect().catch(err => { throw new Error(err) })

            strategy.set(options.strategy)
            console.log('>> Strategy initialized.\n')

            const bot = getTrader()
            bot.startTrading()
        } catch (err) {
            console.log(`>> ${err}`)
            process.exit()
        }
    }

	initTraderBotAsync(config.get())
})
