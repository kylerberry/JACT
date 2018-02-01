const test = require('ava');
const PortfolioManager = require('../lib/PortfolioManager')


test('PortfolioManager initializes', t => {
    let accounts = [{ currency: 'USD' }, { currency: 'LTC' }]
    let options = {
        product: 'LTC-USD'
    }

    const manager = new PortfolioManager(accounts, options)

    t.is(manager instanceof PortfolioManager, true);
})


