const http = require('http');
const https = require('https');
const conf = require('byteballcore/conf');

const app = require('./app');
let server;

if (conf.webSSL.use) {
	server = https.createServer({
		key: conf.webSSL.key,
		cert: conf.webSSL.crt
	}, app);
} else {
	server = http.createServer(app);
}

module.exports = { server, app };
