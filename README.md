## Just Another Crypto Trader

[![Build Status](https://travis-ci.org/kylerberry/JACT.svg?branch=master)](https://travis-ci.org/kylerberry/JACT)
[![Coverage Status](https://coveralls.io/repos/github/kylerberry/JACT/badge.svg?branch=master)](https://coveralls.io/github/kylerberry/JACT?branch=master)

__Use JACT at your own risk__

#### Strategies
GDAX trading bot. Add your own buy/sell strategies or use the ones provided. A custom strategy need only export a function that returns `SHORT`, `LONG` and be put in the `lib/strategies` directory. Technical indicators are provided by [technicalIndicators](https://github.com/anandanand84/technicalindicators). Up-to-date historical data (past 350 periods) can be retreived with `HistoricDataProvider.get()` and used in indicator calculations.

#### Trading
JACT will always place limit orders on your side of the spread to avoid taker fees.

If your strategy signals LONG or SHORT, JACT will try to place an order at the current "best bid" for LONG and "best ask" for SHORT.

If a LONG order is canceled, JACT will continue placing best possible orders until the position is filled either partially or entirely.

if a SHORT order is canceled or partially filled, JACT will continue placing best possible orders until the current position is closed entirely.

#### Stop Loss
JACT will constantly monitor the current price and compare it against any open position. If the current price falls below the `config.stopLoss` percentage it will immediately place a market sell order (has taker fee)

#### Backtesting
JACT has a basic backtesting feature. You can test your strategy against historical data of the dates you provide in `config.backtest.startDate` & `config.backtest.endDate`. Additionally, if you provide a `config.backtest.slippage`, the backtest will apply a random slippage percentage no greater than the percentage provided to ~50% of all buy orders. Although it's not entirely accurate, it adds some noise to simulate market chaos.

### How to: Install
- `npm install`
- configure `config.yaml` _*see sample.config.yaml*_

### How to: Trade
_*JACT is in early development. You may experience bugs. TRADE AT YOUR OWN RISK*
- `npm run jact`
- Have fun getting JACT!

### How to: Backtest

- configure `config.yaml` _*see sample.config.yaml*_
- `npm run backtest`

### Todo
1. Write reports to CSV & add logs
2. Pass indicators and other providers as params to strategy methods
3. Add more strategies
4. Add weighting and more configuration for strategies
5. Remove unecessary class constructors
6. See more issues on [github](https://github.com/kylerberry/JACT/issues)

### CONTRIBUTING
Please link to or create an issue for any pull-request you plan to submit as well as unit tests. Issues should be as detailed as possible and include a screenshot of JACT's console output when necessary.

Run tests:
- `npm test`

Run tests with coverage:
- `npm install nyc -g`
- `nyc npm test`

___

If you've enjoyed JACT, feel free to throw me some change:
- LTC: Le7yGJZtKCXekkyv92DS8yi4ne3Ap34W1m
- BTC: 19kYNueSGhYBzZbvUikJvGFejBdsUQ8CNf
