const test =  require('ava');
const config = require('../lib/ConfigProvider')
const path = require('path')

// gdax calls config really early
config._setConfigPath(path.join(__dirname, '/fixtures/config.yaml'))
config.initFromFile()

const { getTrader, TraderBot } = require('../lib/TraderBot')
const portfolioManager = require('../lib/PortfolioManager')
const strategy = require('../lib/Strategy')()
const CandleProvider = require('../lib/CandleProvider')
const sinon = require('sinon')

test.beforeEach(t => {
	portfolioManager.setAccount({ currency: 'USD', available: 10 })
	t.context.manager = portfolioManager
	t.context.trader = new TraderBot()
})

test('getTrader should return the existing instance', t => {
	// they are same instance
	const trader = getTrader()
	t.is(trader, t.context.trader)
})

test('stopLosses ', t => {
	const trader = t.context.trader
	const manager = t.context.manager
	trader.placeOrder = sinon.spy()

	// a filled buy
	manager.addFilled({
		side: 'buy',
		size: '1.5',
		price: 190
	})

	trader.stopLosses()
	// places the order
	t.true(trader.placeOrder.calledOnce)

	// a filled sell (no remaining position)
	manager.addFilled({
		side: 'sell',
		size: '1.5',
		price: 190
	})

	trader.stopLosses()
	// no position, so it still has same callcount from before
	// doesn't place the order
	t.is(trader.placeOrder.callCount, 1)

	manager.addFilled({
		side: 'buy',
		size: '.5',
		price: 190
	})

	// signal sell, and order opened but unfulfilled
	manager.addOpen({
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
	let trader = t.context.trader
	const manager = t.context.manager

	// 'open' event comes down the feed
	trader.orderPlaced = true
	trader.openHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5'
	})

	t.is(manager.getOpen(123).price, 129)

	// if an externally placed order (manually through gdax web ui)
	// ignore the event
	trader.orderPlaced = false
	trader.openHandler({
		order_id: 999,
		side: 'buy',
		price: 129,
		size: '1.5'
	})

	t.falsy(manager.getOpen(999))
})

test('matchHandler', t => {
	let trader = t.context.trader
	const manager = t.context.manager

	// 'match' event comes down the feed
	trader.orderPlaced = true
	trader.matchHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5'
	})
	t.is(manager.getPositionSize(), 1.5)

	// if an externally placed order (manually through gdax web ui)
	// ignore the event
	trader.orderPlaced = false
	trader.matchHandler({
		order_id: 999,
		side: 'buy',
		price: 129,
		size: '1.5'
	})
	t.is(manager.getPositionSize(), 1.5)

	// sell match trade removes out existing position
	trader.orderPlaced = true
	trader.matchHandler({
		order_id: 123,
		side: 'sell',
		price: 129,
		size: '1.5'
	})
	t.is(manager.getPositionSize(), 0)
})

test('doneHandler', t => {
	const trader = t.context.trader
	const manager = t.context.manager

	// completely filled buy
	trader.orderPlaced = true
	trader.resetFlags = sinon.spy()
	trader.doneHandler({
		order_id: 123,
		side: 'buy',
		price: 129,
		size: '1.5',
		remaining_size: '0',
		reason: 'filled'
	})
	t.is(typeof manager.getOpen(123), 'undefined')
	t.truthy(trader.resetFlags.calledOnce)

	// ignored if fired from external event
	trader.orderPlaced = false
	// hacky test, workaround for unable to spy on removeOpen
	manager.addOpen({
		order_id: 234
	})
	trader.doneHandler({
		order_id: 234,
		side: 'buy',
		price: 129,
		size: '1.5',
		remaining_size: '0',
		reason: 'filled'
	})
	// removeOpen was not called again
	t.truthy(manager.getOpen(234))

	// test not run if stop loss is triggered
	trader.orderPlaced = true
	trader.stopLossTriggered = true
	trader.doneHandler({
		order_id: 234,
		side: 'buy',
		price: 129,
		size: '1.5',
		remaining_size: '0',
		reason: 'filled'
	})
	t.truthy(manager.getOpen(234))

	// partially filled sell
	trader.orderPlaced = true
	trader.placeOrder = sinon.spy()
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
	let trader = t.context.trader
	const manager = t.context.manager

	let cancelledSell = {
		side: 'sell',
		remaining_size: '0.3',
		reason: 'canceled'
	}

	manager.isBidAllowed = () => true
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
	manager.isBidAllowed = () => false
	t.falsy(trader.shouldReplaceOrder(cancelledBuy, 100))
})

test('perform order if remaining size is less than minimumSize', t => {
	let trader = t.context.trader
	const manager = t.context.manager
		
	let fills = [{
 		side: 'buy',
		size: '1',
		reason: 'filled'
	},
	{
		side: 'sell',
		size: '0.95',
		reason: 'filled'
	}]

	fills.forEach(fill => manager.addFilled(fill))

	trader.placeOrder = sinon.spy()
	// if remaining size is less than .1 don't sell
	trader.shortPosition()
 	t.falsy(trader.placeOrder.calledOnce)

	// can buy if remaining position is greater than .1
	trader.longPosition()
 	t.truthy(trader.placeOrder.calledOnce)

})

test('cannot place signaled orders while feed order is unresolved', t => {
	const trader = t.context.trader
	const manager = t.context.manager

	trader.placeOrder = sinon.spy()
	trader.ordersResolved = false
	trader.shortPosition()
	t.falsy(trader.placeOrder.calledOnce)

	trader.longPosition()
	t.falsy(trader.placeOrder.calledOnce)

})
