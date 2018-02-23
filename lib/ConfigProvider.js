const yaml = require('js-yaml')
const fs = require('fs')
const extend = require('lodash/extend')
const each = require('lodash/each')
const cloneDeep = require('lodash/each')

let required = [
	'gdax_auth_secret',
	'gdax_auth_key',
	'gdax_auth_passphrase',
	'strategy',
	'granularity',
	'product',
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

// if a config.yaml exists, it will use that to initialize the config provider
// otherwise it falls back to defaults
let config = null
try {
	let yamlConfig = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'))
	if (!yamlConfig) {
		config = extend({}, defaults, yamlConfig)
	} else {
		config = extend({}, defaults)
	}
} catch (e) {
	console.log('>> Could not parse config.yaml')
	config = extend({}, defaults)
}

/**
 * validates a config obj
 *
 * @param {Object} config
 * @return void
 * @throws Error
 */
const validate = config => {
	for (let prop in config) {
		if (required.indexOf(prop) !== -1 && !config[prop]) {
			throw new Error(`${prop} is required.`)
		}
	}
}

/**
 * Get a config value
 *
 * @param {String} key
 * @return {*}
 */
const get = key => {
	if (typeof config[key] !== 'undefined') {
		return config[key]
	}
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
		opts = extend({}, opts, update)
    }

    if (defaults[update] !== 'undefined' && typeof value !== 'undefined') {
        opts[update] = value
	}

	// validate the new config
	// if error, revert config before changes
	try {
		validate(opts)
		config = opts
		return true
	} catch (err) {
		console.log(`>> ERROR: ${err}`)
		return false
	}

	return false
}

module.exports = { get, set }
