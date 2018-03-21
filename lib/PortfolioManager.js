const find = require('lodash/find')
const cloneDeep = require('lodash/cloneDeep')
const remove = require('lodash/remove')
const findLast = require('lodash/findLast')
const config = require('./ConfigProvider')

let account = null
let filled = []
let open = []
let minimumOrderSize = null

const minimums = {
    'LTC-USD' : .1,
    'BTC-USD': .001,
    'ETH-USD': .01,
}

/**
 * Add a filled order
 * @param {Object} data 
 * @return void
 */
const addFilled = (data) => {
    filled.push(data)
}

/**
 * get all the filled orders
 * @return {Array}
 */
const getFilled = () => {
    return cloneDeep(filled)
}

/**
 * get the last filled order
 * @return {Object}
 */
const getLastFilled = () => {
    return filled[filled.length - 1]
}

/**
 * get the last filled buy
 * @return {Object}
 */
const getLastBuy = () => {
    return findLast(filled, { side: 'buy' })
}

/**
 * get the current position size
 * 
 * @return {Number}
 */
const getPositionSize = () => {
    if (!filled.length) {
        return 0
    }

    return filled.reduce((acc, trade) => {
        if (trade.side == 'buy') {
            return acc + parseFloat(trade.size)
        } else {
            return acc - parseFloat(trade.size)
        }
    }, 0)
}

/**
 * Get the minimum order size
 * 
 * @return {Number}
 */
const getMinimumOrderSize = () => {
    return minimumOrderSize
}

/**
 * Add an open order
 * 
 * @param {Object} data 
 */
const addOpen = (data) => {
    open.push(data)
}

/**
 * Get an open order by id or the last
 * 
 * @param {String} id 
 */
const getOpen = (id) => {
    if (!id) {
        return open[open.length - 1]
    }
    return find(open, {order_id: id})
}

/**
 * Remove an open order by ID
 * 
 * @param {String} id 
 */
const removeOpen = (id) => {
    if (!id) {
        open.pop()
    }
    remove(open, o => o.order_id == id)
}

/**
 * If passed price triggers a stop loss market sell
 * 
 * @param {Number} price 
 */
const shouldTriggerStop = (price) => {
    let lastBuy = getLastBuy()
    if (getPositionSize() < getMinimumOrderSize()) {
        return false
    }

    return price <= (lastBuy.price - (config.get('stop_loss') * lastBuy.price))
}

/**
 * takes a signal price and proposed price for next order and 
 * checks if within allowable slippage range
 * 
 * @param {Number} signalPrice
 * @param {Number} proposedPrice
 * @return {Boolean}
 */
const isBidAllowed = (signalPrice, proposedPrice) => {
    return proposedPrice <= signalPrice + (signalPrice * config.get('allowed_slippage'))
}

/**
 * Get the net and percent profit of all trades
 * 
 * @return {Object}
 */
const getTotals = () => {
    let lastBuy = null
    let net = filled.reduce((acc, trade) => {
        if (trade.side == 'buy') {
            lastBuy = trade
            return acc
        } else {
            return acc + (trade.price * trade.size) - (lastBuy.price * lastBuy.size)
        }
    }, 0)

    lastBuy = null
    let percent = filled.reduce((acc, trade) => {
        if (trade.side == 'sell') {
            return acc + (trade.price / lastBuy.price) - 1
        } else {
            lastBuy = trade
            return acc
        }
    }, 0)
    return {
        usd: net.toFixed(4),
        percent: percent.toFixed(4)
    }
}

/**
 * Get the average of all losing trades
 */
const getAvgLoss = () => {
    let lastBuy = null
    let sizeAcc = 0
    let priceAcc = 0
    let numPartials = 0
    let losses = filled.reduce((acc, trade) => {
        if (trade.side == 'sell') {
            let tradeSize = parseFloat(trade.size)
            let buySize = parseFloat(lastBuy.size)
            numPartials++
            priceAcc += (trade.price * tradeSize)
            sizeAcc += tradeSize
            if (sizeAcc == buySize) {
                priceAcc = priceAcc - (lastBuy.price * buySize)
                if (priceAcc < 0) {
                    acc.push({ net: priceAcc, percent: priceAcc / (lastBuy.price * buySize) })
                }
            }
            return acc
        } else {
            sizeAcc = priceAcc = numPartials = 0
            lastBuy = trade
            return acc
        }
    }, [])
    
    if (!losses.length) {
        return {}
    }

    return {
        usd: (losses.reduce((acc, loss) => acc += loss.net, 0) / losses.length).toFixed(4),
        percent: (losses.reduce((acc, loss) => acc += loss.percent, 0) / losses.length).toFixed(4)
    }
}

/**
 * Get the average of all winning trades
 */
const getAvgWin = () => {
    let lastBuy = null
    let sizeAcc = 0
    let priceAcc = 0
    let numPartials = 0
    let wins = filled.reduce((acc, trade) => {
        if (trade.side == 'sell') {
            let tradeSize = parseFloat(trade.size)
            let buySize = parseFloat(lastBuy.size)
            numPartials++
            priceAcc += (trade.price * tradeSize)
            sizeAcc += tradeSize
            if (sizeAcc == buySize) {
                priceAcc = priceAcc - (lastBuy.price * buySize)
                if (priceAcc >= 0) {
                    acc.push({ net: priceAcc, percent: priceAcc / (lastBuy.price * buySize) })
                }
            }
            return acc
        } else {
            sizeAcc = priceAcc = numPartials = 0
            lastBuy = trade
            return acc
        }
    }, [])

    if (!wins.length) {
        return {}
    }

    return {
        usd: (wins.reduce((acc, win) => acc += win.net, 0) / wins.length).toFixed(4),
        percent: (wins.reduce((acc, win) => acc += win.percent, 0) / wins.length).toFixed(4)
    }
}

/**
 * Get completed win & loss counts
 * 
 * @return {Object}
 */
const getCompleted = () => {
    let priceAcc = 0
    let sizeAcc = 0
    let lastBuy = null
    let wins = 0
    let losses = 0
    let numPartials = 0
    filled.forEach(trade => {
        if (trade.side == 'sell') {
            numPartials++
            priceAcc += (trade.price * trade.size)
            sizeAcc += trade.size
            if (sizeAcc == parseFloat(lastBuy.size)) {
                priceAcc = priceAcc - (lastBuy.price * lastBuy.size)
                if (priceAcc >= 0) {
                    wins++
                } else {
                    losses++
                }
            }
        } else {
            sizeAcc = priceAcc = numPartials = 0
            lastBuy = trade
        }
    })
    return { wins, losses }
}

/**
 * Calculate the average slippage of all orders
 * 
 * @TODO figure out how to calculate this now that we have no buy signal price
 * @return {Number}
 */
// const getAvgSlippage = () => {
    //((trade.price - lastBuy.price) / (lastBuy.price - lastBuy.signal_price) + (trade.signal_price - trade.price)) - 1
// }

/**
 * State of the account
 * 
 * @return {Object}
 */
const info = () => {
    let completed = getCompleted()
    return {
        lastTrade: getLastFilled(),
        totalTrades: getFilled().length,
        wins: completed.wins,
        losses: completed.losses,
        avgSlippage: undefined,//getAvgSlippage().toFixed(4),
        avgWin: getAvgWin(),
        avgLoss: getAvgLoss(),
        netProfit: getTotals()
    }
}

/**
 * Gets the order size for the provided product based on available funding
 * 
 * @param {Float} price
 * @return {String}
 */
const getOrderSize = (price) => {
    let fixedDecimalMax = 8
    return (getFundingAmount() / price).toFixed(fixedDecimalMax)
}

/**
 * Gets available funding from the provided product account
 * 
 * @return {Number}
 */
const getFundingAmount = () => {
    let amount = account.available
    return config.get('max_funds') && amount > config.get('max_funds') ? config.get('max_funds') : amount
}

/**
 * Set/Reset the account 
 * 
 * @return {Number}
 */
const setAccount = newAccount => {
    account = newAccount
    filled = []
    open = []
    minimumOrderSize = minimums[config.get('product')]
}

module.exports = {
    setAccount,
    addFilled,
    getFilled,
    getLastFilled,
    getLastBuy,
    getPositionSize,
    addOpen,
    getOpen,
    removeOpen,
    shouldTriggerStop,
    isBidAllowed,
    getTotals,
    getAvgLoss,
    getAvgWin,
    getCompleted,
    // getAvgSlippage,
    info,
    getOrderSize,
    getFundingAmount,
    getMinimumOrderSize
}