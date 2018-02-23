const fs = require('fs');

const stratRelPath = './strategies'
const stratRootPath = './lib/strategies'

let strategy = null

module.exports = () => ({
	set: stratName => {
		stratName += stratName.indexOf('.js') == -1 ? '.js' : ''
		if (stratName && fs.existsSync(`${stratRootPath}/${stratName}`)) {
			strategy = require(`${stratRelPath}/${stratName}`)
		} else {
			throw new Error(`Could not find strategy '${stratName}'.`)
		}
	},
	get: () => {
		return strategy
	},
	signal: () => {
		return strategy()
	}
})
