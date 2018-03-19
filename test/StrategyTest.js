const test = require('ava');
const strategy = require('../lib/Strategy')()

test('Strategy initializes with a provided strategy filename', t => {
	strategy.set('macd')
	t.is(typeof strategy.get(), 'function')

	strategy.set('macd.js')
	t.is(typeof strategy.get(), 'function')
})

test('Strategy throws error if valid strategy name or path is not provided', t => {
    const err = t.throws(() => {
		strategy.set('poop')
    }, Error)

    t.truthy(err)
})

