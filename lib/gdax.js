const Gdax = require('gdax')
const config = require('./config')

const gdaxClient = new Gdax.AuthenticatedClient(
	config.gdaxAuth.key,
	config.gdaxAuth.secret,
	config.gdaxAuth.passphrase,
	'https://api.gdax.com'
)

const sandboxClient = new Gdax.AuthenticatedClient(
	config.gdaxSandboxAuth.key,
	config.gdaxSandboxAuth.secret,
	config.gdaxSandboxAuth.passphrase,
	'https://api-public.sandbox.gdax.com'
)

const websocket = new Gdax.WebsocketClient(
	[config.product],
	'wss://ws-feed.gdax.com',
	{
		key: config.gdaxAuth.key,
		secret: config.gdaxAuth.secret,
		passphrase: config.gdaxAuth.passphrase,
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
)

const sandboxWebsocket = new Gdax.WebsocketClient(
	[config.product],
	'wss://ws-feed-public.sandbox.gdax.com',
	{
		key: config.gdaxSandboxAuth.key,
		secret: config.gdaxSandboxAuth.secret,
		passphrase: config.gdaxSandboxAuth.passphrase,
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
)

module.exports = {
	gdax: config.sandbox ? sandboxClient : gdaxClient,
	websocket: config.sandbox ? sandboxWebsocket : websocket,
	DANGER_LIVE_GDAX_DANGER: gdaxClient, // provided because the sandbox clients don't always provide reliable data
	DANGER_LIVE_WEBSOCKET_DANGER: websocket // provided because the sandbox clients don't always provide reliable data
}