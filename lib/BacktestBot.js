const { gdax, websocket, DANGER_LIVE_GDAX_DANGER, DANGER_LIVE_WEBSOCKET_DANGER } = require('./gdax')
const moment = require('moment')

const HistoricDataProvider = require('./HistoricDataProvider')
const BacktestDataProvider = require('./BacktestDataProvider')

var ProgressBar = require('ascii-progress');
const notifier = require('node-notifier');

class BacktestBot {
    constructor({
        strategy,
        manager,
        options
    }) {
        this.strategy = strategy
        this.manager = manager
        this.options = options
    }

    /**
     * Let the trading begin!
     * Subscribe to feed data and init trading
     * 
     * @return void
     */
    startTrading() {
        console.log(`>> Backtesting ${this.options.product} with ${this.options.granularity} seconds with ${this.options.strategy} strategy from ${this.options.backtest.start_date} to ${this.options.backtest.end_date || moment().toISOString()}.\n`)
        this.progress = new ProgressBar({
            schema: ':bar.green :percent',
            total: BacktestDataProvider.getLength()
        });
        setTimeout(this.trade.bind(this), 200)
    }

    /**
     * Execute a strategy with a historical dataset
     * 
     * @return void
     */
    trade() {
        HistoricDataProvider.append(BacktestDataProvider.shiftData())
        let newLength = BacktestDataProvider.getLength()
        let signal = this.strategy.signal()
        
        if (signal == 'LONG') {
            this.longPosition()
        } else if (signal == 'SHORT') {
            this.shortPosition()
        }

        if (newLength) {
            this.progress.tick()
            this.trade()
            return
        } else {
            this.progress.clear()
            console.log('>> Backtest complete.\n')
            console.log(this.manager.info())
            console.log('\n')
            notifier.notify({
                title: 'JACT',
                message: 'Backtest complete!'
            });
            process.exit()
        }   
    }

    longPosition() {
        if (this.manager.getPosition()) {
            return
        }

        // kind of makes a best-case scenario assumption here (not ideal)
        let best_bid = BacktestDataProvider.current()[4] // low
        let params = {
            side: 'buy',
            size: this.manager.getOrderSize(best_bid),
            price: best_bid
        }

        this.manager.openPosition(params)
        params.remaining_size = 0
        this.manager.updatePosition(params)
        this.manager.addFilled(params)
    }

    shortPosition() {
        let position = this.manager.getPosition()
        if (!position) {
            return
        }
        
        // kind of makes a best-case scenario assumption here
        let best_ask = BacktestDataProvider.current()[4] // high
        let params = {
            side: 'sell',
            size: position.size,
            price: best_ask
        }

        this.manager.closePosition(params)
        params.remaining_size = 0
        this.manager.updatePosition(params)
        this.manager.addFilled(params)
    }
}
module.exports = BacktestBot