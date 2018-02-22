const test =  require('ava');
const TraderBot = require('../lib/TraderBot')
const PortfolioManager = require('../lib/PortfolioManager')
const Strategy = require('../lib/Strategy')
const extend = require('lodash/extend')
const sinon = require('sinon')
// import sinon from 'sinon';

// test.beforeEach(t => {
// 	t.context.log = sinon.spy();
// });

// test.afterEach(t => {
// 	t.context.log.restore();
// });

// test('first', t => {
// 	t.context.log('first');
// 	t.true(t.context.log.calledOnce);
// });

// test('second', t => {
// 	t.context.log('second');
// 	t.true(t.context.log.calledOnce);
// });

// mock Strategy
const getStrategyInstance = (params = {}) => {
	let defaultOptions = {
		strategy: 'macd'
	}
	let options = extend({}, params, defaultOptions);
	return new Strategy(options)
}

// mock Manager
const getManagerInstance = (params = {}) => {
	let defaultAccounts = [{ currency: 'USD' }, { currency: 'LTC' }]
	let defaultOptions = { product: 'LTC-USD' }

	let accounts = params.accounts ? params.accounts : defaultAccounts;
	let options = extend({}, params.options, defaultOptions);

	return new PortfolioManager(accounts, options)
}

// mock Trader
const getTraderInstance = (params = {}) => {
	let defaultOptions = {
		product: 'LTC-USD',
		logging: false
	}

	let options = extend({}, params.options, defaultOptions);
	let strategy = getStrategyInstance(options)
	let manager = getManagerInstance(params)

	let trader = new TraderBot({strategy, manager, options})
	// mock place order
	trader.placeOrder = sinon.spy()
	return trader
}

test('TraderBot initializes', t => {
    const trader = getTraderInstance()
    t.is(trader instanceof TraderBot, true)
})

test('stopLosses', t => {
	const trader = getTraderInstance()

	// a filled buy
	trader.manager.addFilled({
		side: 'buy',
		size: '1.5',
		price: 190
	})

	trader.stopLosses()
	// places the order
	t.true(trader.placeOrder.calledOnce)

	// a filled sell (no position)
	trader.manager.addFilled({
		side: 'sell',
		size: '1.5',
		price: 190
	})

	trader.stopLosses()
	// no position, so it still has same callcount from before
	// doesn't place the order
	t.is(trader.placeOrder.callCount, 1)


	trader.manager.addFilled({
		side: 'buy',
		size: '.5',
		price: 190
	})

	// signal sell, and order opened but unfulfilled
	trader.manager.addOpen({
		order_id: 123,
		side: 'sell',
		size: '.2',
		price: 180
	})

	// test that it cancels an open order
	let spy = sinon.spy()
	trader.cancelOrder = spy
	trader.stopLosses()
	t.true(spy.withArgs(123).calledOnce)
})
