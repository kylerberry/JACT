const express = require('express');
const config = require('./routes/config');

var app = express();
app.use('/config', config);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use(function(err, req, res, next) {
	// render the error message
	res.status(err.status || 500);
	res.json({ error: err.message });
});

module.exports = app;
