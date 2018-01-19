class TraderBot {
    constructor({
        strategy,
        manager
    }) {
        console.log(strategy)
        console.log(manager)
    }

    startTrading() {
        console.log('Im trading')
    }
}

module.exports = TraderBot