const test = require('ava');
const Strategy = require('../lib/Strategy')

let historicData = []

const generateMockHistoricData = trend => {
    if (trend == 'bearish') {
    } else if (trend == 'bullish') {

    } else if (trend == 'ranging') {

    }
}

//[time, low, high, open, close, volume]
//time asc, older -> newer
let historicDataFixture = [
    [moment(), 100, 100, 100, 100, 30000],
    [moment().add(1, 'second'), 100, 100, 100, 100, 30000],
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000],
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
    [moment().add(2, 'second'), 100, 100, 100, 100, 30000]
]

test('Strategy initializes with a provided strategy filename', t => {
    const providedStrat = new Strategy({ strategy: 'macd' })
    t.is(providedStrat instanceof Strategy, true, 'without extension');

    // this test is brittle because it relies on an external file source to be there
    const customStrat = new Strategy({ strategy: 'private.strategy' })
    t.is(customStrat instanceof Strategy, true, 'without extension');

    const providedStratDotJs = new Strategy({ strategy: 'macd.js' })
    t.is(providedStratDotJs instanceof Strategy, true, 'with extension');

    // this test is brittle because it relies on an external file source to be there
    const customStratDotJs = new Strategy({ strategy: 'private.strategy.js' })
    t.is(customStratDotJs instanceof Strategy, true, 'with extension');
})

test('Strategy throws error if valid strategy name or path is not provided', t => {
    const err = t.throws(() => {
        const strategy = new Strategy({})
    }, Error)
    
    t.truthy(err)
})

test('Strategy.signal returns `LONG`, `SHORT`, or null', t => {
    const strat = new Strategy({ strategy: 'macd'})
})

