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

    // test full trades
    let fills = [{
        side: 'buy',
        size: '1',
        price: '100'
    },
    {
        side: 'sell',
        size: '1',
        price: '110'
    }]

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(parseFloat(manager.getAvgWin().usd), 10)
    t.is(parseFloat(manager.getAvgWin().percent), 10)

    // test partially filled trades
    fills = [{
        side: 'buy',
        size: 1,
        price: '100'
    },
    {
        side: 'sell',
        size: .3,
        price: '110'
    },
    {
        side: 'sell',
        size: .7,
        price: '105'
    }]

    const managerTwo = getManagerInstance()
    fills.forEach(trade => managerTwo.addFilled(trade))
    t.is(parseFloat(managerTwo.getAvgWin().usd), 6.5)
    t.is(parseFloat(managerTwo.getAvgWin().percent), 6.5)
})

test('getAvgLoss', t => {

    // test full trades
    let fills = [{
        side: 'buy',
        size: '1',
        price: '100'
    },
    {
        side: 'sell',
        size: '1',
        price: '90'
    }]

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(parseFloat(manager.getAvgLoss().usd), -10)
    t.is(parseFloat(manager.getAvgLoss().percent), -10)

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
    t.is(parseFloat(managerTwo.getAvgLoss().usd), -17)
    t.is(parseFloat(managerTwo.getAvgLoss().percent), -17)
})

test('getCurrentRemainingPositionSize', t => {
    const manager = getManagerInstance()
    manager.addFilled({
        side: 'buy',
        size: '1',
        price: '100'
    })
    t.is(manager.getCurrentRemainingPositionSize(), 1)

    manager.addFilled({
        side: 'sell',
        size: '.3',
        price: '110',
    })
    t.is(manager.getCurrentRemainingPositionSize(), .7)

    manager.addFilled({
        side: 'sell',
        size: '.7',
        price: '110',
    })
    t.is(manager.getCurrentRemainingPositionSize(), 0)
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