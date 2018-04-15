const http = require('http');
const https = require('https');
const conf = require('byteballcore/conf');
const fs = require('fs');
const desktopApp = require('byteballcore/desktop_app.js');

const app = require('./app');
let server;

const appDataDir = desktopApp.getAppDataDir();


if (conf.bUseSSL) {
	server = https.createServer({
		key: fs.readFileSync(appDataDir+'/key.pem'),
		cert: fs.readFileSync(appDataDir+'/cert.pem')
	}, app);
} else {
	server = http.createServer(app);
}

module.exports = { server, app };
