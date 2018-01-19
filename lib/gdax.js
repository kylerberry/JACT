const Gdax = require('gdax')
const config = require('./config')

const gdaxClient = new Gdax.AuthenticatedClient(
	config.gdax_auth.key,
	config.gdax_auth.secret,
	config.gdax_auth.passphrase,
	'https://api.gdax.com'
)

const sandboxClient = new Gdax.AuthenticatedClient(
	config.gdax_sandbox_auth.key,
	config.gdax_sandbox_auth.secret,
	config.gdax_sandbox_auth.passphrase,
	'https://api-public.sandbox.gdax.com'
)

const websocket = new Gdax.WebsocketClient(
	[config.product],
	'wss://ws-feed.gdax.com',
	{
		key: config.gdax_auth.key,
		secret: config.gdax_auth.secret,
		passphrase: config.gdax_auth.passphrase,
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
)

const sandboxWebsocket = new Gdax.WebsocketClient(
	[config.product],
	'wss://ws-feed-public.sandbox.gdax.com',
	{
		key: config.gdax_sandbox_auth.key,
		secret: config.gdax_sandbox_auth.secret,
		passphrase: config.gdax_sandbox_auth.passphrase,
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
)

module.exports = {
	gdax: config.sandbox ? sandboxClient : gdaxClient,
	websocket: config.sandbox ? sandboxWebsocket : websocket,
	DANGER_LIVE_GDAX_DANGER: gdaxClient, // provided because the sandbox clients don't always provide reliable data
	DANGER_LIVE_WEBSOCKET_DANGER: websocket // provided because the sandbox clients don't always provide reliable data
}