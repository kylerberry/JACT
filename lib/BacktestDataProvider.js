let data = []
let index = 0

const append = chunk => {
    data = data.concat(chunk.reverse())
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

const previous = () => {
    index--
    if (index < 0) {
        return false
    }
    return data[index]
}

const setCursor = (i) => {
    if (!data[i]) {
        return false
    }
    index = i
    return true
}

module.exports = {
    append, next, previous, current, setCursor
}