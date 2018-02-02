const test = require('ava');
const Strategy = require('../lib/Strategy')

let historicData = []

// const generateMockHistoricData = trend => {
//     if (trend == 'bearish') {

//     } else if (trend == 'bullish') {

//     } else if (trend == 'ranging') {

//     }
// }

test('Strategy initializes with a provided strategy filename', t => {
    const strat = new Strategy({ strategy: 'macd' })
    t.is(strat instanceof Strategy, true, 'without extension');

    const stratDotJs = new Strategy({ strategy: 'rsi.js' })
    t.is(stratDotJs instanceof Strategy, true, 'with extension');
})

test('Strategy throws error if valid strategy name or path is not provided', t => {
    const err = t.throws(() => {
        const strategy = new Strategy({})
    }, Error)
    
    t.truthy(err)
})

// @todo
test('Strategy.signal returns `LONG`, `SHORT`, or null', t => {
    const strat = new Strategy({ strategy: 'macd'})
    t.pass()
})

