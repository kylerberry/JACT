const test = require('ava');
const portfolioManager = require('../lib/PortfolioManager')
const extend = require('lodash/extend')
const config = require('../lib/ConfigProvider')
const path = require('path')

test.beforeEach(t => {
    config.readConfig(path.join(__dirname, '/fixtures/config.json'))
    portfolioManager.setAccount({ currency: 'USD', available: 10 })
    t.context.manager = portfolioManager
})

test('getAvgWin for fully filled trades', t => {
    // test full trades, multiple wins, complex sizes
    let fills = [{
        side: 'buy',
        size: '2.27262397',
        price: 220.01
    },
    {
        side: 'sell',
        size: '2.27262397',
        price: 223.43
    },
    {
        side: 'buy',
        size: '3.27262397',
        price: 220.01
    },
    {
        side: 'sell',
        size: '3.27262397',
        price: 223.43
    }]

    fills.forEach(trade => t.context.manager.addFilled(trade))
    t.is(t.context.manager.getAvgWin().usd, '9.4824')
    t.is(t.context.manager.getAvgWin().percent, '0.0155')
})

test('getAvgWin for partially filled trades', t => {
    // test partially filled trades
    let fills = [{
        side: 'buy',
        size: '1.3',
        price: '100'
    },
    {
        side: 'sell',
        size: '.2',
        price: '110'
    },
    {
        side: 'sell',
        size: '1.1',
        price: '105'
    }]

    fills.forEach(trade => t.context.manager.addFilled(trade))
    let wins = t.context.manager.getAvgWin()
    t.is(wins.usd, '7.5000')
    t.is(wins.percent, '0.0577')
})


test('getAvgLoss for fully filled trades', t => {

    // test full trades
    let fills = [{
        side: 'buy',
        size: '2.27262397',
        price: 220.01
    },
    {
        side: 'sell',
        size: '2.27262397',
        price: 217.43
    },
    {
        side: 'buy',
        size: '3.27262397',
        price: 220.01
    },
    {
        side: 'sell',
        size: '3.27262397',
        price: 200.43
    }]

    fills.forEach(trade => t.context.manager.addFilled(trade))
    let losses = t.context.manager.getAvgLoss()
    t.is(losses.usd, '-34.9707')
    t.is(losses.percent, '-0.0504')
})

test('avgLoss for partially filled trades', t => {
    // test partially filled trades
    let fills = [{
        side: 'buy',
        size: 1,
        price: '100'
    },
    {
        side: 'sell',
        size: .3,
        price: '90'
    },
    {
        side: 'sell',
        size: .7,
        price: '80'
    }]

    fills.forEach(trade => t.context.manager.addFilled(trade))
    let losses = t.context.manager.getAvgLoss()
    t.is(losses.usd, '-17.0000')
    t.is(losses.percent, '-0.1700')
})

test('getPositionSize', t => {
    let manager = t.context.manager

    manager.addFilled({
        side: 'buy',
        size: '1',
        price: '100'
    })
    t.is(manager.getPositionSize(), 1)

    manager.addFilled({
        side: 'sell',
        size: '.3',
        price: '110',
    })
    t.is(manager.getPositionSize(), .7)

    manager.addFilled({
        side: 'sell',
        size: '.7',
        price: '110',
    })
    t.is(manager.getPositionSize(), 0)
})

test('shouldTriggerStop', t => {
    let manager = t.context.manager

    manager.addFilled({
        side: 'buy',
        size: '1',
        price: '100'
    })

    t.is(manager.shouldTriggerStop(94.99), true)
    t.is(manager.shouldTriggerStop(95.00), true)
    t.is(manager.shouldTriggerStop(95.01), false)
})

test('isBidAllowed', t => {
    let manager = t.context.manager

    let signaledPrice = 100
    let bestBid = 101

    t.is(manager.isBidAllowed(100, 101), true)
    t.is(manager.isBidAllowed(100, 101.01), false)
    t.is(manager.isBidAllowed(100, 100.10), true)
})


test('getFundingAmount', t => {
    let manager = t.context.manager
    
    // with maxFunds config
    config.set('max_funds', 5)
    t.is(manager.getFundingAmount(), 5)

    // without maxFunds config
    config.set('max_funds', null)
    t.is(manager.getFundingAmount(), 10)
})

test('getOrderSize', t => {
    //with maxFunds config
    portfolioManager.setAccount({ currency: 'USD', available: 100 })
    let manager = t.context.manager
    config.set('max_funds', 50)

    let currentPrice = 100
    t.is(manager.getOrderSize(currentPrice), '0.50000000')

    // without maxFunds config
    config.set('max_funds', null)
    t.is(manager.getOrderSize(currentPrice), '1.00000000')
})