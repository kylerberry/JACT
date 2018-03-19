const yaml = require('js-yaml')
const fs = require('fs')
const extend = require('lodash/extend')
const each = require('lodash/each')
const cloneDeep = require('lodash/each')
const omit = require('lodash/omit')
const path = require('path')

let required = [
	'gdax_auth_secret',
	'gdax_auth_key',
	'gdax_auth_passphrase',
	'strategy',
	'granularity',
	'product',
]

let protected = [
	'gdax_auth_secret',
	'gdax_auth_key',
	'gdax_auth_passphrase'
]

let defaults = {
	gdax_auth_secret : null,
	gdax_auth_key : null,
	gdax_auth_passphrase : null,
	strategy: 'macd',
	granularity: 900,
	product: 'BTC-USD',
	stop_loss: null,
	allowed_slippage: null,
	max_funds: null,
	logging: false
}

let config = null
let configPath = path.join(__dirname, '/../config.yaml')

/**
 * For mocking fixture paths
 *
 * @param {String} path
 */
const _setConfigPath = path => {
	configPath = path
}

// if a config.yaml exists, it will use that to initialize the config provider
// otherwise it falls back to defaults
const initFromFile = () => {
	try {
		let yamlConfig = yaml.safeLoad(
			fs.readFileSync(
				configPath, 'utf8'
			)
		)

		if (!yamlConfig) {
			config = Object.assign({}, defaults)
		} else {
			config = Object.assign({}, defaults, yamlConfig)
		}
	} catch (e) {
		console.log(`>> Could not parse config.yaml: ${e}`)
		config = Object.assign({}, defaults)
	}
}

/**
 * validates a config obj
 *
 * @param {Object} config
 * @return void
 * @throws Error
 */
const _validate = config => {
	if (!config) {
		throw new Error(`${prop} is required.`)
	}
	required.forEach(prop => {
		if (typeof config[prop] == 'undefined' || !config[prop]) {
			throw new Error(`${prop} is required.`)
		}
	})
	return true
}

/**
 * Get a config value
 *
 * @param {String} key
 * @return {*}
 */
const get = key => {
	if (!config) {
		initFromFile()
	}
	if (config && typeof config[key] !== 'undefined') {
		return config[key]
	}
	return Object.assign({}, config)
}

/**
 * Get safe config values
 *
 * @param {String} key
 * @return {*}
 */
const getSafe = () => {
	if (!config) {
		initFromFile()
	}
	let safe = Object.assign({}, config)
	return omit(safe, protected)
}

/**
 * Update the config
 *
 * @param {String|Object} update
 * @param {*} value
 */
const set = (update, value) => {
	let opts = Object.assign({}, config);

    if (!value && typeof update == 'object') {
		opts = Object.assign({}, opts, update)
    }

    if (defaults[update] !== 'undefined' && typeof value !== 'undefined') {
        opts[update] = value
	}

	// validate the new config before saving
	try {
		_validate(opts)
		config = opts
		return true
	} catch (err) {
		console.log(`>> ConfigProvider: ${err}`)
		return false
	}
}

module.exports = { get, set, initFromFile, _setConfigPath, _validate, getSafe }
