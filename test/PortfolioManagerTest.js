const test = require('ava');
const PortfolioManager = require('../lib/PortfolioManager')

const getManagerInstance = (params = {}) => {
    let accounts = params.accounts ? params.accounts : [{ currency: 'USD' }, { currency: 'LTC' }]
    let options = params.options ? params.options : {product: 'LTC-USD'}
    return new PortfolioManager(accounts, options)
}

test('PortfolioManager initializes', t => {
    const manager = getManagerInstance()
    t.is(manager instanceof PortfolioManager, true);
})

test('PortfolioManager.getAvgWin', t => {

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

test('PortfolioManager.getAvgLoss', t => {

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