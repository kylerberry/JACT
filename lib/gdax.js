const Gdax = require('gdax')
const options = require('./cl-args')()
require('dotenv').config()

// make sure to test with sandbox API with handling authenticated requests
const gdaxClient = new Gdax.AuthenticatedClient(
	process.env.GDAX_API_KEY,
	process.env.GDAX_API_SECRET,
	process.env.GDAX_API_PASSPHRASE,
	process.env.GDAX_URL
)

const sandboxClient = new Gdax.AuthenticatedClient(
	process.env.GDAX_SANDBOX_API_KEY,
	process.env.GDAX_SANDBOX_API_SECRET,
	process.env.GDAX_SANDBOX_API_PASSPHRASE,
	process.env.GDAX_SANDBOX_URL
)

const websocket = new Gdax.WebsocketClient(
	[options.product],
	process.env.GDAX_WSS_URL,
	{
		key: process.env.GDAX_API_KEY,
		secret: process.env.GDAX_API_SECRET,
		passphrase: process.env.GDAX_API_PASSPHRASE,
	},
	{ channels: ['ticker', 'heartbeat', 'user']}
)

const sandboxWebsocket = new Gdax.WebsocketClient(
	[options.product],
	process.env.GDAX_SANDBOX_WSS_URL,
	{
		key: process.env.GDAX_SANDBOX_API_KEY,
		secret: process.env.GDAX_SANDBOX_API_SECRET,
		passphrase: process.env.GDAX_SANDBOX_API_PASSPHRASE,
	},
	{ channels: ['ticker', 'heartbeat', 'user'] }
)

module.exports = {
	gdax: process.env.ENV == 'PRODUCTION' ? gdaxClient : sandboxClient,
	websocket: process.env.ENV == 'PRODUCTION' ? websocket : sandboxWebsocket,
	CAREFUL_PRODUCTION_GDAX: gdaxClient,
	CAREFUL_PRODUCTION_WEBSOCKET: websocket
}