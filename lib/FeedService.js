const moment = require('moment')
const { websocket } = require('./gdax')

/*
Subscribable Events

subscriptions:
    - confirmation of subscribed feed types: ticker, heartbeat, user

ticker:
    - realtime price & volume data

heartbeat:
    - received roughly every second to monitor feed connection

received:
    - A valid order has been received and is now active. This message is emitted for every single valid order as soon as the matching engine receives it whether it fills immediately or not.
    - The received message does not indicate a resting order on the order book

open:
    - The order is now open on the order book.This message will only be sent for orders which are not fully filled immediately.
    - remaining_size will indicate how much of the order is unfilled and going on the book.

change:
    - change messages are sent anytime an order changes in size; this includes resting orders (open) as well as received but not yet open

match:
    - A trade occurred between two orders.The aggressor or taker order is the one executing immediately after being received and the maker order is a resting order on the book
    
done:
    - The order is no longer on the order book.Sent for all orders for which there was a received message.This message can result from an order being canceled or filled.
    - remaining_size indicates how much of the order went unfilled; this will be 0 for filled orders.

activate:
    - An activate message is sent when a stop order is placed

*/

let subscriptions = {}
let latestHeartbeat = moment()
let socketReconnect = true

/**
 * Process websocket 'message' event
 * 
 * @param {Object} data 
 * @return void
 */
const processMessage = (data) => {
    applyHandlers(data.type, data)
}

/**
 * Process websocket 'error' event
 * 
 * @param {Object} error 
 * @return void
 */
const processError = (error) => {
    console.log(`>> Websocket Error: ${error}\n`)
    websocket.socket.close()
}

/**
 * Process websocket 'close' event
 * 
 * @return void
 */
const processClose = () => {
    if (!socketReconnect) {
        console.log('>> Websocket connection closed.')
        return
    }

    console.log('>> Websocket closed unexpectedly. Attempting to re-connect...')
    websocket.connect()

    let tries = 1
    // attempt to re-connect every 30 seconds.
    const interval = setInterval(() => {
        if (!websocket.socket) {
            tries++;

            if (tries % 30 === 0) {
                console.log(`>> Websocket could not reconnect after ${tries} attempts. Shutting down.`)
                process.exit()
            }
            websocket.connect()
            console.log('>> Successfully restarted Websocket connection.')
        }
        else {
            clearInterval(interval)
        }
    }, 30000);
}

/**
 * Subscribe callbacks to feed data types
 * 
 * @param {String} event 
 * @param {Function} callback 
 */
const subscribe = (event, callback) => {
    if (subscriptions[event]) {
        subscriptions[event].push(callback)
    } else {
        subscriptions[event] = [callback]
    }
}

/** 
 * Apply all subscribed callbacks for an event
 * 
 * @param {String} type
 * @param {Object} data
 * @return void 
*/
const applyHandlers = (type, data) => {
    if (!subscriptions[type]) {
        return
    }
    subscriptions[type].forEach(cb => cb(data))
}

/**
 * Connect the websocket and monitor health
 * 
 * @return void
 */
const connect = () => {
    const maxSkippedBeats = 15

    subscribe('heartbeat', data => {
        latestHeartbeat = moment(data.time)
    })

    const heartbeatInterval = setInterval(() => {
        let now = new moment()
        if (now.diff(latestHeartbeat, 'seconds') >= maxSkippedBeats) {
            console.log('>> Websocket skipped a beat. Attempting to reconnect...')
            clearInterval(heartbeatInterval)
            websocket.socket.close()
        }
    }, 1000)

    websocket.on('message', processMessage)
    websocket.on('error', processError)
    websocket.on('close', processClose)

    return new Promise((resolve, reject) => {
        try {
            subscribe('ticker', function (data) {
                resolve(data)
            })
        } catch (err) {
            reject(err)
        }
    })
}

module.exports = { subscribe, connect }