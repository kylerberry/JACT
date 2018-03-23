const Gdax = require('gdax')
const config = require('./ConfigProvider')

const initGdax = () => ({
	gdax: new Gdax.AuthenticatedClient(
		config.get('gdax_auth_key'),
		config.get('gdax_auth_secret'),
		config.get('gdax_auth_passphrase'),
		'https://api.gdax.com'
	),
	websocket: new Gdax.WebsocketClient(
		[config.get('product')],
		'wss://ws-feed.gdax.com',
		{
			key: config.get('gdax_auth_key'),
			secret: config.get('gdax_auth_secret'),
			passphrase: config.get('gdax_auth_passphrase'),
		},
		{ channels: ['ticker', 'heartbeat', 'user'] }
	)
})

let clients = null

// export a function to call when we're ready to use gdax.
module.exports = () => {
	if (!clients) {
		clients = initGdax()
	}
	return clients
}
