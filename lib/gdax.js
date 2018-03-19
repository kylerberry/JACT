const Gdax = require('gdax')
const config = require('./ConfigProvider')

/* const sandboxClient = new Gdax.AuthenticatedClient(
	config.get('gdax_sandbox_auth_key'),
	config.get('gdax_sandbox_auth_secret'),
	config.get('gdax_sandbox_auth_passphrase'),
	'https://api-public.sandbox.gdax.com'
) */

/* const sandboxWebsocket = new Gdax.WebsocketClient(
	[config.get('product')],
	'wss://ws-feed-public.sandbox.gdax.com',
	{
		key: config.get('gdax_sandbox_auth_key'),
			secret: config.get('gdax_sandbox_auth_secret'),
			passphrase: config.get('gdax_sandbox_auth_passphrase'),
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
) */

module.exports = {
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
}