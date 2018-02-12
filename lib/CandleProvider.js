const moment = require('moment')
const _toArray = require('lodash/toArray')
const _cloneDeep = require('lodash/cloneDeep')
const FeedService = require('./FeedService')
const config = require('./config')

let defaults = {
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

let data = _cloneDeep(defaults)

let candleStart = null

let hasUpdated = false

const state = () => {
    return data
}

const reset = () => {
    data = _cloneDeep(defaults)
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
    let time = moment(realtimeData.time)

    if (!candleStart) {
        candleStart = time
    }

    if (time.diff(candleStart, 'seconds') >= config.granularity) {
        reset()
        candleStart = time
    }

    data.time = time.unix()
    let price = parseFloat(realtimeData.price)

    data.close = price
    data.best_ask = parseFloat(realtimeData.best_ask)
    data.best_bid = parseFloat(realtimeData.best_bid)
    data.side = realtimeData.side

    if (!data.open) {
        data.open = price
    }
    

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

module.exports = {state, update, toArray, hasData, reset}