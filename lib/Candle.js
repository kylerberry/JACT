const moment = require('moment')
const toArray = require('lodash/toArray')

class Candle {
    constructor() {
        this.data = {
            time : null,
            low : null,
            high : null,
            open : null,
            close : null,
            volume : null,
            best_bid: null,
            best_ask: null,
            side: null
        }
    }

    /**
     * get values from the current candle
     * 
     * @param {String} key 
     * @return {Object|null}
     */
    get(key = null) {
        if (!key) {
            return this.data
        }
        return this.data[key] || null
    }

    /**
     * format candle to array [ time, low, high, open, close, volume, ... ]
     * 
     * @return {Array}
     */
    toArray() {
        return toArray(this.get())
    }

    /**
     * update the candle state from feed data
     * 
     * @param {Object} realtimeData 
     * @return void
     */
    update(realtimeData) {
        let price = parseFloat(realtimeData.price)

        this.data.close = price

        if (!this.data.open) {
            this.data.open = price
        }
        this.data.time = moment(realtimeData.time).unix()
        
        if (!this.data.low || (this.data.low && price < this.data.low)) {
            this.data.low = price
        }
        if (!this.data.high || (this.data.high && price > this.data.high)) {
            this.data.high = price
        }
        if (!this.data.volume) {
            this.data.volume = parseFloat(realtimeData.last_size)
        } else {
            this.data.volume += parseFloat(realtimeData.last_size)
        }

        this.data.best_ask = parseFloat(realtimeData.best_ask)
        this.data.best_bid = parseFloat(realtimeData.best_bid)
        this.data.side = realtimeData.side
    }
}

module.exports = Candle