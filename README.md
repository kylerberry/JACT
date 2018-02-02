## Just Another Crypto Trader
__Use JACT at your own risk__

#### Strategies
GDAX trading bot. Add your own buy/sell strategies or use the ones provided. A custom strategy need only export a function that returns `SHORT`, `LONG` and be put in the `lib/strategies` directory. Technical indicators are provided by [technicalIndicators](https://github.com/anandanand84/technicalindicators). Up-to-date historical data (past 350 periods) can be retreived with `HistoricDataProvider.get()` and used in indicator calculations.

#### Trading
JACT will always place limit orders on your side of the spread to avoid taker fees. If your strategy signals a LONG or SHORT position, JACT will continue placing best possible orders until the position is fully filled (based on `config.maxFunds` and/or your account balance).

For example if the strategy signals LONG for 1 BTC, but only gets partially filled for .5 BTC or gets cancelled. Then, JACT will open a new order for the remaining size(.5) at the current best bid. It will continue doing this until the full 1 BTC position is filled.

#### Stop Loss
JACT will constantly monitor the current price and compare it against any open position. If the current price falls below the `config.stopLoss` percentage it will immediately place a market sell order (has taker fee)

### How to use
- `npm install`
- configure `config.yaml` _*see sample.config.yaml*_
- `npm run jact`
- Have fun getting JACT!

### Run tests
`npm test`

_*test coverage is still in progress*_
### Todo
1. Add Backtesting
2. Write reports to CSV
3. Add more strategies
4. Add weighting and more configuration for strategies
5. Find out why indicators take roughly 5 periods before they start to become reliable
6. Remove unecessary class constructors

If you've enjoyed JACT, feel free to throw me some change:
- LTC: Le7yGJZtKCXekkyv92DS8yi4ne3Ap34W1m
- BTC: 19kYNueSGhYBzZbvUikJvGFejBdsUQ8CNf
