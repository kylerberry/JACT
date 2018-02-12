## Just Another Crypto Trader
__Use JACT at your own risk__

#### Strategies
GDAX trading bot. Add your own buy/sell strategies or use the ones provided. A custom strategy need only export a function that returns `SHORT`, `LONG` and be put in the `lib/strategies` directory. Technical indicators are provided by [technicalIndicators](https://github.com/anandanand84/technicalindicators). Up-to-date historical data (past 350 periods) can be retreived with `HistoricDataProvider.get()` and used in indicator calculations.

#### Trading
JACT will always place limit orders on your side of the spread to avoid taker fees.

If your strategy signals a LONG position, JACT will try to place an order at the current best_bid. However, if it is canceled, or partially filled JACT will not open more orders to fill the remaining size of the original order. This is done to manage slippage.

Conversely, If your strategy signals SHORT, JACT will continue placing best possible orders until the position is fully filled and closed.

For example: the strategy signals LONG to buy 1 BTC, but only gets partially filled for .5 BTC. JACT will wait for a SHORT signal. On SHORT, it will open a sell order for .5 BTC. If that order is canceled or partially filled, it will continue opening orders at best_ask, every minute, until the position is fully sold. _*This may change in the future*_

#### Stop Loss
JACT will constantly monitor the current price and compare it against any open position. If the current price falls below the `config.stopLoss` percentage it will immediately place a market sell order (has taker fee)

#### Backtesting
JACT has a basic backtesting feature. You can test your strategy against historical data of the dates you provide in `config.backtest.start_date` & `config.backtest.end_date`. Additionally, if you provide a `config.backtest.slippage`, each completed position's net will be minimized by the provided percentage to simulate slippage in real market conditions.

### How to: Trade
_*JACT is in early development. You may experience bugs. TRADE AT YOUR OWN RISK*
- `npm install`
- configure `config.yaml` _*see sample.config.yaml*_
- `npm run jact`
- Have fun getting JACT!

### How to: Backtest
_*Backtesting is an early feature. You may experience bugs*

- configure `config.yaml` _*see sample.config.yaml*_
- `npm run backtest`

### Todo
1. Write reports to CSV
2. Add more strategies
3. Add weighting and more configuration for strategies
4. Remove unecessary class constructors

### CONTRIBUTING
Please link to or create an issue for any pull-request you plan to submit as well as unit tests. Issues should be as detailed as possible and include a screenshot of JACT's console output when necessary.

Run tests with
- `npm test`

_*test coverage is still in progress*_
===============

If you've enjoyed JACT, feel free to throw me some change:
- LTC: Le7yGJZtKCXekkyv92DS8yi4ne3Ap34W1m
- BTC: 19kYNueSGhYBzZbvUikJvGFejBdsUQ8CNf
