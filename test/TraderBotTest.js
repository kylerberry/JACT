const test =  require('ava');
const TraderBot = require('../lib/TraderBot')
const PortfolioManager = require('../lib/PortfolioManager')
const Strategy = require('../lib/Strategy')
const CandleProvider = require('../lib/CandleProvider')
const extend = require('lodash/extend')
const sinon = require('sinon')

// @TODO look into using macros to reproduce some functionality
// @TODO maybe break some tests into smaller units

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

	// a filled sell (no remaining position)
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

	// test that it cancels the open order
	trader.cancelOrder = sinon.spy()
	trader.stopLosses()
	t.true(trader.cancelOrder.withArgs(123).calledOnce)
})

test('openHandler', t => {
	let trader = getTraderInstance()

	// 'open' event comes down the feed
	trader.orderPlaced = true
	trader.openHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5'
	})

	t.is(trader.manager.getOpen(123).price, 129)

	// if an externally placed order (manually through gdax web ui)
	// ignore the event
	trader.orderPlaced = false
	trader.openHandler({
		order_id: 999,
		side: 'buy',
		price: 129,
		size: '1.5'
	})

	t.falsy(trader.manager.getOpen(999))
})

test('matchHandler', t => {
	let trader = getTraderInstance()

	// 'match' event comes down the feed
	trader.orderPlaced = true
	trader.matchHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5'
	})
	t.is(trader.manager.getRemainingPositionSize(), 1.5)

	// if an externally placed order (manually through gdax web ui)
	// ignore the event
	trader.orderPlaced = false
	trader.matchHandler({
		order_id: 999,
		side: 'buy',
		price: 129,
		size: '1.5'
	})
	t.is(trader.manager.getRemainingPositionSize(), 1.5)

	// sell match trade removes out existing position
	trader.orderPlaced = true
	trader.matchHandler({
		order_id: 123,
		side: 'sell',
		price: 129,
		size: '1.5'
	})
	t.is(trader.manager.getRemainingPositionSize(), 0)
})

test('doneHandler', t => {
	let trader = getTraderInstance()

	// completely filled buy
	trader.orderPlaced = true
	trader.manager.removeOpen = sinon.spy()
	trader.resetFlags = sinon.spy()
	trader.doneHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5',
		remaining_size: '0',
		reason: 'filled'
	})
	t.truthy(trader.manager.removeOpen.withArgs(123).calledOnce)
	t.truthy(trader.resetFlags.calledOnce)

	// ignored if fired from external event
	trader.orderPlaced = false
	trader.doneHandler({
		order_id: 234,
		side: 'buy',
		price: 129,
		size: '1.5',
		remaining_size: '0',
		reason: 'filled'
	})
	// removeOpen was not called again
	t.is(trader.manager.removeOpen.callCount, 1)

	// partially filled sell
	trader.orderPlaced = true
	trader.shouldReplaceOrder = () => true
	trader.doneHandler({
		order_id: 345,
		side: 'sell',
		price: 130,
		size: '1.2',
		remaining_size: '0.3',
		reason: 'filled'
	})
	t.truthy(trader.placeOrder.withArgs({
		side: 'sell',
		size: .3,
		price: 129.75,
		post_only: true,
		time_in_force: 'GTT',
		cancel_after: 'min'
	}))
})

test('shouldReplaceOrder', t => {
	let trader = getTraderInstance()

	let cancelledSell = {
		side: 'sell',
		remaining_size: '0.3',
		reason: 'canceled'
	}

	trader.manager.isBidAllowed = () => true
	t.truthy(trader.shouldReplaceOrder(cancelledSell, 100))

	let cancelledBuy = {
		side: 'buy',
		remaining_size: '0.3',
		reason: 'canceled'
	}
	t.truthy(trader.shouldReplaceOrder(cancelledBuy, 100))

	let filledBuy = {
		side: 'buy',
		remaining_size: '0.3',
		reason: 'filled'
	}
	t.falsy(trader.shouldReplaceOrder(filledBuy, 100))

	let filledSell = {
		side: 'sell',
		remaining_size: '0',
		reason: 'filled'
	}
	t.falsy(trader.shouldReplaceOrder(filledSell, 100))

	let filledPartialSell = {
		side: 'sell',
		remaining_size: '0.3',
		reason: 'filled'
	}
	t.truthy(trader.shouldReplaceOrder(filledPartialSell, 100))

	// canceled buy but bid is not allowed
	trader.manager.isBidAllowed = () => false
	t.falsy(trader.shouldReplaceOrder(cancelledBuy, 100))
})
