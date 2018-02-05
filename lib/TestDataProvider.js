let data = []

const connect = historicData => {
    data = historicData.reverse()
}

const append = realtimeData => {
    data.push(realtimeData)
    data.shift()
    return data
}

const get = () => {
    return data
}

module.exports = {
    connect, append, get
}