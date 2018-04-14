const morgan = require('morgan');
const log = require('./../libs/logger')(module);

const IS_DEBUG = process.env.NODE_ENV !== 'production';

exports.out = morgan(IS_DEBUG ? 'dev' : 'combined', {
	skip: (req, res) => res.statusCode >= 400,
	stream: log.stream('info')
});

exports.err = morgan(IS_DEBUG ? 'dev' : 'combined', {
	skip: (req, res) => res.statusCode < 400,
	stream: log.stream('error')
});