const express = require('express');
const config = require('../../lib/ConfigProvider')
const router = express.Router();

router.get('/', function(req, res, next) {
	res.json(config.getSafe());
});

module.exports = router;
