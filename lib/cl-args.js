const strategies = require('./strategies')

module.exports = () => {
    const argKeys = {
        '--granularity' : true,
        '--product': true,
        '--strategy': true
    }

    const args = process.argv

    let options = {}
    args.forEach((value, i) => {
        if (argKeys[value]) {
            let key = value.substr(2, value.length-1)
            let nextValue = args[i + 1]

            switch(key) {
                case 'strategy':
                    options[key] = strategies[nextValue] || strategies.macd
                break
                default:
                    options[key] = nextValue
            }
        }
    })

    return options
}