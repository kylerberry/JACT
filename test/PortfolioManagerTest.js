const test = require('ava');
const PortfolioManager = require('../lib/PortfolioManager')
const extend = require('lodash/extend')

const getManagerInstance = (params = {}) => {
    let defaultAccounts = [{ currency: 'USD' }, { currency: 'LTC'}]
    let defaultOptions = { product: 'LTC-USD' }

    let accounts = params.accounts ? params.accounts : defaultAccounts;
    let options = extend({}, params.options, defaultOptions);

    return new PortfolioManager(accounts, options)
}

test('PortfolioManager initializes', t => {
    const manager = getManagerInstance()
    t.is(manager instanceof PortfolioManager, true);
})

test('getAvgWin', t => {

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

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(manager.getAvgWin().usd, '9.4824')
    t.is(manager.getAvgWin().percent, '0.0155')

    // test partially filled trades
    fills = [{
        side: 'buy',
        size: 1.3,
        price: '100'
    },
    {
        side: 'sell',
        size: .2,
        price: '110'
    },
    {
        side: 'sell',
        size: 1.1,
        price: '105'
    }]

    const managerTwo = getManagerInstance()
    fills.forEach(trade => managerTwo.addFilled(trade))
    t.is(managerTwo.getAvgWin().usd, '7.5000')
    t.is(managerTwo.getAvgWin().percent, '0.0577')
})

test('getAvgLoss', t => {

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

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(manager.getAvgLoss().usd, '-34.9707')
    t.is(manager.getAvgLoss().percent, '-0.0504')

    // test partially filled trades
    fills = [{
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

    const managerTwo = getManagerInstance()
    fills.forEach(trade => managerTwo.addFilled(trade))
    t.is(managerTwo.getAvgLoss().usd, '-17.0000')
    t.is(managerTwo.getAvgLoss().percent, '-0.1700')
})

test('getRemainingPositionSize', t => {
    const manager = getManagerInstance()
    manager.addFilled({
        side: 'buy',
        size: '1',
        price: '100'
    })
    t.is(manager.getRemainingPositionSize(), 1)

    manager.addFilled({
        side: 'sell',
        size: '.3',
        price: '110',
    })
    t.is(manager.getRemainingPositionSize(), .7)

    manager.addFilled({
        side: 'sell',
        size: '.7',
        price: '110',
    })
    t.is(manager.getRemainingPositionSize(), 0)
})

test('shouldTriggerStop', t => {
    const manager = getManagerInstance({
        options: {
            stopLoss: .05
        }
    })

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
    const manager = getManagerInstance({
        options: {
            allowedSlippage: .01
        }
    })

    let signaledPrice = 100
    let bestBid = 101

    t.is(manager.isBidAllowed(100, 101), true)
    t.is(manager.isBidAllowed(100, 101.01), false)
    t.is(manager.isBidAllowed(100, 100.10), true)
})

test('getFundingAmount', t => {
    // with maxFunds config
    const manager = getManagerInstance({
        accounts: [{ currency: 'USD', available: 10 }],
        options: { maxFunds: 5 }
    })

    t.is(manager.getFundingAmount(), 5)

    // without maxFunds config
    const managerTwo = getManagerInstance({
        accounts: [{ currency: 'USD', available: 10 }],
    })

    t.is(managerTwo.getFundingAmount(), 10)
})

test('getOrderSize', t => {
    //with maxFunds config
    const manager = getManagerInstance({
        accounts: [{ currency: 'USD', available: 100 }],
        options: { maxFunds: 50 }
    })

    let currentPrice = 100
    t.is(manager.getOrderSize(currentPrice), '0.50000000')

    // without maxFunds config
    const managerTwo = getManagerInstance({
        accounts: [{ currency: 'USD', available: 100 }]
    })

    t.is(managerTwo.getOrderSize(currentPrice), '1.00000000')
})