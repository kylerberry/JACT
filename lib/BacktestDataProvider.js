let data = []
let index = 0

const connect = backtestData => {
    data = backtestData.reverse()
}

const current = () => {
    return data[index]
}

const next = () => {
    index++
    if (index > data.length-1) {
        return false
    }
    return data[index]
}

/**
 * shift data so that we can speed up the process as we go (mutate the data array to take up less memory)
 */
const shiftData = () => {
    return data.shift()
}

const previous = () => {
    index--
    if (index < 0) {
        return false
    }
    return data[index]
}

const getLength = () => {
    return data.length
}

module.exports = {
    connect, next, previous, current, getLength, shiftData
}