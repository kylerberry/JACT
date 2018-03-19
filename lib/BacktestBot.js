const { gdax, websocket } = require('./gdax')
const moment = require('moment')
const config = require('./ConfigProvider')

const HistoricDataProvider = require('./HistoricDataProvider')
const BacktestDataProvider = require('./BacktestDataProvider')

const ProgressBar = require('ascii-progress');
const uuid = require('uuid/v1')
const { TraderBot } = require('./TraderBot')
const manager = require('./PortfolioManager')
const strategy = require('./Strategy')()

class BacktestBot extends TraderBot {
    constructor() {
        super()

        this.startMoment = moment(config.get('backtest_start_date'))
        this.endMoment = config.get('backtest_end_date') ? moment(config.get('backtest_end_date')) : moment()
        this.chunkSize = 350
        this.rateLimit = 3
        this.iterations = 0
    }

    /**
     * Let the trading (backtest) begin!
     * Gets historic data for initial analyzing and first series of candles
     * 
     * @return void
     */
    async startTrading() {
        console.log(`>> Backtesting ${config.get('product')} with ${config.get('granularity')} seconds with ${config.get('strategy')} strategy from ${config.get('backtest_start_date')} to ${config.get('backtest_end_date') || moment().toISOString()}.\n`)
        this.progress = new ProgressBar({
            schema: ':bar.green :percent',
            total: this.endMoment.diff(this.startMoment, 'seconds') / config.get('granularity'),
            clear: true
        });

        // this should move into backtest.js
        let preData = await this.getDataChunk(null, this.startMoment)
        HistoricDataProvider.connect(preData)
        let endChunkDate = moment(this.startMoment).add(this.chunkSize * config.get('granularity'), 'seconds')
        let firstChunk = await this.getDataChunk(this.startMoment, endChunkDate)
        BacktestDataProvider.append(firstChunk)
        this.trade()
    }

    /**
     * wait for 1 second to avoid being rate limited by gdax api
     * 
     * @return {Promise}
     */
    async rateLimitResolver() {
        return new Promise(resolve => {
            setTimeout(resolve, 1000);
        })
    }

    /**
     * Get Data Chunk
     * 
     * @return Promise
     */
    async getDataChunk(start, end) {
        if (this.iterations == this.rateLimit) {
            await this.rateLimitResolver()
            this.iterations = 0
        }
        this.iterations++
        let chunk = gdax.getProductHistoricRates(config.get('product'), {
            granularity: config.get('granularity'),
            start: start ? start.toISOString() : null,
            end: end ? end.toISOString() : null
        }).catch(err => { throw new Error(err) })

        if (chunk.message) {
            throw new Error(chunk.message)
        }

        return chunk
    }

    /**
     * Execute a strategy with a historical dataset
     * Chunks data fetching and analyzations to avoid 
     * stackoverflows and speed up backtesting
     * 
     * @return void
     */
    async trade() {
        HistoricDataProvider.append(BacktestDataProvider.current())
        let signal = strategy.signal()

        if (manager.shouldTriggerStop(BacktestDataProvider.current()[4])) {
            this.shortPosition()
        } else if (signal == 'LONG') {
            this.longPosition()
        } else if (signal == 'SHORT') {
            this.shortPosition()
        }

        if (BacktestDataProvider.next()) {
            this.progress.tick()
            this.trade()
            return
        } else {
            let lastTick = moment(BacktestDataProvider.previous()[0] * 1000)
            let nextTick = moment(lastTick).add(config.get('granularity'), 'seconds')
            let nextTickDiff = this.endMoment.diff(nextTick, 'seconds')
            if (nextTickDiff <= 0) {
                this.stopTrading()
                return
            }
            let nextChunkSize = Math.min(nextTickDiff, config.get('granularity') * this.chunkSize)
            let nextChunkEnd = moment(nextTick).add(nextChunkSize, 'seconds')
            let chunk = await this.getDataChunk(
                nextTick,
                nextChunkEnd
            )
            BacktestDataProvider.append(chunk)
            BacktestDataProvider.next()
            this.trade()
        }
    }

    /**
     * Mock slippage for the backtest
     * 
     * @return {Number}
     */
    getSlippage() {
        let slipMax = config.get('backtest_slippage')
        if (!slipMax) {
            return 0
        }

        // 50% odds of incurring slippage
        let slipOdds = Math.random() <= .5
        if (!slipOdds) {
            return 0
        }

        // random slippage percent no higher than provided in config
        return Math.random() * slipMax
    }

    /**
     * open a position, update, fill
     * 
     * @return void
     */
    longPosition() {
        if (manager.getRemainingPositionSize()) {
            return
        }

        // mock random slippage
        let slippage = this.getSlippage()
        let signaledClose = BacktestDataProvider.current()[4]
        let bestBid = signaledClose + (signaledClose * slippage)
        this.signaledBuyPrice = signaledClose
        let params = {
            order_id: uuid(),
            side: 'buy',
            size: manager.getOrderSize(bestBid),
            price: bestBid,
            reason: 'filled',
            remaining_size: 0,
            time: moment().seconds()
        }

        this.orderPlaced = true

        // mock the feed
        this.openHandler(params)
        this.matchHandler(params)
        this.doneHandler(params)
    }

    /**
     * close a position, update, fill
     * 
     * @return void
     */
    shortPosition() {
        let positionSize = manager.getRemainingPositionSize()
        if (!positionSize) {
            return
        }

        // kind of makes a best-case scenario assumption here
        let best_ask = BacktestDataProvider.current()[4]
        let params = {
            order_id: uuid(),
            side: 'sell',
            size: positionSize,
            price: best_ask,
            reason: 'filled',
            remaining_size: 0,
            time: moment().seconds()
        }

        this.orderPlaced = true

        // mock the feed
        this.openHandler(params)
        this.matchHandler(params)
        this.doneHandler(params)
    }

    /**
     * Stop the test and log the results
     * 
     * @return void
     */
    stopTrading() {
        this.progress.clear()
        setInterval(function() {
            console.log('>> Backtest complete.\n')
            console.log(manager.info())
            console.log('\n')
            clearInterval(this)
            process.exit()
        }, 200)
    }
}

module.exports = BacktestBot