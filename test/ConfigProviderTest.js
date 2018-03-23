const test = require('ava');
const config = require('../lib/ConfigProvider')
const path = require('path')

let configPath = path.join(__dirname, '/fixtures/config.json')

let defaults =  {
	gdax_auth_secret: 'someSecret',
	gdax_auth_key: 'someKey',
	gdax_auth_passphrase: 'somePassphrase',
	strategy: 'macd',
	granularity: 900,
	product: 'BTC-USD',
	stop_loss: null,
	allowed_slippage: null,
	max_funds: null,
	logging: false
}

test('Config initializes from a config.json file', t => {	
	config.readConfig(configPath)
	t.is(config.get('product'), 'LTC-USD')
})

test('Validate a config object', t => {
	let badConfig = Object.assign({}, defaults)
	delete badConfig.gdax_auth_secret
	// throws on bad config
	t.truthy(t.throws(() => {
		config._validate(badConfig)
	}, Error))

	// true on good config
	t.truthy(config._validate(defaults))
})

test('Set config', t => {
	//initial setup
	config.set(defaults)

	// set by key, value
	config.set('product', 'ETH-USD')
	t.is(config.get('product'), 'ETH-USD')

	// set by object
	config.set({
		strategy: 'rsi'
	})
	t.is(config.get('strategy'), 'rsi')

	// config unchanged if an invalid option is passed
	t.is(config.set({
		gdax_auth_key: null
	}), false)
	t.is(config.get('gdax_auth_key'), 'someKey')
})

test('get safe config', t => {
	t.is(config.get().gdax_auth_key, 'someKey')
	t.is(config.getSafe().gdax_auth_key, undefined)
})
