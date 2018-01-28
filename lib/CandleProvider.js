const moment = require('moment')
const _toArray = require('lodash/toArray')
const FeedService = require('./FeedService')

let data = {
    time: null,
    low: null,
    high: null,
    open: null,
    close: null,
    volume: null,
    best_bid: null,
    best_ask: null,
    side: null
}

let hasUpdated = false

/**
 * get values from the current candle
 * 
 * @param {String} key 
 * @return {Object|null}
 */
const get = (key = null) => {
    if (!key) {
        return state()
    }
    return data[key] || null
}

const state = () => {
    return data
}

/**
 * format candle to array [ time, low, high, open, close, volume, ... ]
 * 
 * @return {Array}
 */
const toArray = () => {
    return _toArray(state())
}

/**
 * update the candle state from feed data
 * 
 * @param {Object} realtimeData 
 * @return void
 */
const update = (realtimeData) => {
    let price = parseFloat(realtimeData.price)

    data.close = price

    if (!data.open) {
        data.open = price
    }
    data.time = moment(realtimeData.time).unix()

    if (!data.low || (data.low && price < data.low)) {
        data.low = price
    }
    if (!data.high || (data.high && price > data.high)) {
        data.high = price
    }
    if (!data.volume) {
        data.volume = parseFloat(realtimeData.last_size)
    } else {
        data.volume += parseFloat(realtimeData.last_size)
    }

    data.best_ask = parseFloat(realtimeData.best_ask)
    data.best_bid = parseFloat(realtimeData.best_bid)
    data.side = realtimeData.side
    
    hasUpdated = true
}

/**
 * Make sure the provider has data before using
 * 
 * @return {Boolean}
 */
const hasData = () => {
    return hasUpdated
}

FeedService.subscribe('ticker', update.bind(this))

module.exports = {get, state, update, toArray, hasData}