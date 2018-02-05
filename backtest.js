'use strict';
const app = require('express')()
const config = require('./lib/config')
const moment = require('moment')
const HistoricDataProvider = require('./lib/HistoricDataProvider')
const BacktestDataProvider = require('./lib/BacktestDataProvider')

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

    let responseSize = 350
    let testData = []
    let preData = []
    let startMoment = moment(config.backtest.start_date).utc()
    let endMoment = moment(config.backtest.end_date || moment()).utc()
    let rateLimit = 3
    let rateCount = 0

    /**
     * resolve after 1 second to avoid gdax rate limiting
     * 
     * @return {Promise}
     */
    async function rateLimitResolver() {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, 1000)
        })
    }

    /**
     * get historical and test data range
     * @todo needs to handle different granularities
     * 
     * @param {Object} options 
     * @param {Date} chunkStart | ISO8610
     * @param {Date} chunkEnd | ISO8610
     * @return {Promise}
     */
    async function getTestData(options, chunkStart, chunkEnd) {
        if (chunkStart <= startMoment) {
            preData = await DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(options.product, {
                granularity: options.granularity,
                end: startMoment.toISOString()
            }).catch(err => { throw new Error(err) })
            if (preData.message) {
                throw new Error(preData.message)
            }
            BacktestDataProvider.connect(flatten(testData))
            HistoricDataProvider.connect(preData)
            console.log('>> Backtest data compiled.')
            return true
        } else {
            let chunkData
            if (rateCount >= rateLimit) {
                rateCount = 0
                await rateLimitResolver()
            }
            chunkData = await DANGER_LIVE_GDAX_DANGER.getProductHistoricRates(options.product, {
                granularity: options.granularity,
                start: chunkStart.toISOString(),
                end: chunkEnd.toISOString()
            }).catch(err => { throw new Error(err) })
            if (chunkData.message) {
                throw new Error(chunkData.message)
            }
            rateCount++
            console.log(`>> Fetched ${chunkStart.toISOString()} to ${chunkEnd.toISOString()}...`)
            testData.push(chunkData)
            let nextEnd = moment(chunkStart).subtract(options.granularity, 'seconds')
            let nextStart = moment(nextEnd).subtract(options.granularity * responseSize, 'seconds')
            return await getTestData(options, nextStart, nextEnd)
        }
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

            console.log('>> Fetching test data.')
            await getTestData(
                config,
                moment(endMoment).subtract(responseSize, 'minutes'),
                endMoment
            )

            let strategy = new Strategy(options)
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