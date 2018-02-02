const test =  require('ava');
const TraderBot = require('../lib/TraderBot')


test('TraderBot initializes', t => {
    let strategy = {}
    let manager = {}
    let options = {}

    const trader = new TraderBot({
        strategy, manager, options
    })

    t.is(trader instanceof TraderBot, true)
})

// test('TraderBot opens a long position', t => {
//     t.pass()
// })


