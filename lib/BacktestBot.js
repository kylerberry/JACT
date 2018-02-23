const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const HistoricDataProvider = require('./HistoricDataProvider')
const BacktestDataProvider = require('./BacktestDataProvider')

const ProgressBar = require('ascii-progress');
const uuid = require('uuid/v1')
const TraderBot = require('./TraderBot')

class BacktestBot extends TraderBot {
    constructor({
        strategy,
        manager,
        options
    }) {
        super({
            strategy,
            manager,
            options
        })

        this.startMoment = moment(this.options.backtest.startDate)
        this.endMoment = this.options.backtest.endDate ? moment(this.options.backtest.endDate) : moment()
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
        console.log(`>> Backtesting ${this.options.product} with ${this.options.granularity} seconds with ${this.options.strategy} strategy from ${this.options.backtest.startDate} to ${this.options.backtest.endDate || moment().toISOString()}.\n`)
        this.progress = new ProgressBar({
            schema: ':bar.green :percent',
            total: this.endMoment.diff(this.startMoment, 'seconds') / this.options.granularity,
            clear: true
        });
        let preData = await this.getDataChunk(null, this.startMoment)
        HistoricDataProvider.connect(preData)
        let endChunkDate = moment(this.startMoment).add(this.chunkSize * this.options.granularity, 'seconds')
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
        let chunk = gdax.getProductHistoricRates(this.options.product, {
            granularity: this.options.granularity,
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
        let signal = this.strategy.signal()

        if (this.manager.shouldTriggerStop(BacktestDataProvider.current()[4])) {
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
            let nextTick = moment(lastTick).add(this.options.granularity, 'seconds')
            let nextTickDiff = this.endMoment.diff(nextTick, 'seconds')
            if (nextTickDiff <= 0) {
                this.stopTrading()
                return
            }
            let nextChunkSize = Math.min(nextTickDiff, this.options.granularity * this.chunkSize)
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
        let slipMax = this.options.backtest.slippage
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
        if (this.manager.getRemainingPositionSize()) {
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
            size: this.manager.getOrderSize(bestBid),
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
        let positionSize = this.manager.getRemainingPositionSize()
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
        let self = this
        setInterval(function() {
            console.log('>> Backtest complete.\n')
            console.log(self.manager.info())
            console.log('\n')
            clearInterval(this)
            process.exit()
        }, 200)
    }
}

module.exports = BacktestBot