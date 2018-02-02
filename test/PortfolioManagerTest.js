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
    let fills = [{
        side: 'buy',
        size: '0.5',
        price: '100',
        remaining_size: '.5'
    },
    {
        side: 'buy',
        size: '0.5',
        price: '105',
        remaining_size: '0.000'
    },
    {
        side: 'sell',
        size: '1',
        price: '110',
        remaining_size: '0.000'
    }]

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(manager.getAvgWin(), 7.5)

    fills = [{
        side: 'buy',
        size: '0.33',
        price: '900',
        remaining_size: '.66'
    },
    {
        side: 'buy',
        size: '.66',
        price: '850',
        remaining_size: '0.000'
    },
    {
        side: 'sell',
        size: '.66',
        price: '900',
        remaining_size: '.33'
    },
    {
        side: 'sell',
        size: '.33',
        price: '890',
        remaining_size: '0.000'
    }]

    const managerTwo = getManagerInstance()
    fills.forEach(trade => managerTwo.addFilled(trade))
    t.is(managerTwo.getAvgWin(), 30.000000000000114)
})

test('PortfolioManager.getAvgLoss', t => {
    let fills = [{
        side: 'buy',
        size: '0.5',
        price: '100',
        remaining_size: '.5'
    },
    {
        side: 'buy',
        size: '0.5',
        price: '105',
        remaining_size: '0.000'
    },
    {
        side: 'sell',
        size: '1',
        price: '99',
        remaining_size: '0.000'
    }]

    const manager = getManagerInstance()
    fills.forEach(trade => manager.addFilled(trade))
    t.is(manager.getAvgLoss(), 3.5)

    // no loss
    fills = [{
        side: 'buy',
        size: '0.33',
        price: '900',
        remaining_size: '.66'
    },
    {
        side: 'buy',
        size: '.66',
        price: '850',
        remaining_size: '0.000'
    },
    {
        side: 'sell',
        size: '.66',
        price: '900',
        remaining_size: '.33'
    },
    {
        side: 'sell',
        size: '.33',
        price: '890',
        remaining_size: '0.000'
    }]

    const managerTwo = getManagerInstance()
    fills.forEach(trade => managerTwo.addFilled(trade))
    t.is(managerTwo.getAvgLoss(), 0)

    fills = [{
        side: 'buy',
        size: '.99',
        price: '900',
        remaining_size: '0.000'
    },
    {
        side: 'sell',
        size: '.66',
        price: '800',
        remaining_size: '.33'
    },
    {
        side: 'sell',
        size: '.33',
        price: '820',
        remaining_size: '0.000'
    }]

    const managerThree = getManagerInstance()
    fills.forEach(trade => managerThree.addFilled(trade))
    t.is(managerThree.getAvgLoss(), 84.33333333333326)
})

