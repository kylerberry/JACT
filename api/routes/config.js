const express = require('express');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const router = express.Router();

router.get('/', function(req, res, next) {
	var bin = path.dirname(require.main.filename);
	const config = yaml.safeLoad(fs.readFileSync(bin + '/../../config.yaml', 'utf8'));
	config.gdaxAuth = { credentials: 'sanitized' };
	res.json(config);
});

module.exports = router;
