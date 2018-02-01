## Just Another Crypto Trader

Opinionated trading bot. For now, it can only be used with GDAX. Add your own buy/sell strategies or use the ones provided. A custom strategy need only export a function that returns `SHORT` or `LONG`. Technical indicators are provided by [technicalIndicators](https://github.com/anandanand84/technicalindicators). Up-to-date historical data (past 350 periods) can be retreived with `HistoricDataProvider.get()` and used in indicator calculations.

### How to use
- `npm install`
- configure `config.yaml` _*see sample.config.yaml*_
- `npm run jact`
- Have fun getting JACT!

__Use JACT at your own risk__

### Todo
1. Unit Tests
2. Add Backtesting
3. Write reports to CSV
4. Add more strategies
5. Add weighting and more configuration for strategies
6. Find out why indicators take roughly 5 periods before they start to become reliable
7. Remove unecessary class constructors
