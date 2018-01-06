/*jslint node: true */
'use strict';
var bitcoin = require('bitcoin');
var constants = require('byteballcore/constants.js');
var conf = require('byteballcore/conf.js');

var bTestnet = constants.version.match(/t$/);

var client = new bitcoin.Client({
	host: 'localhost',
	port: bTestnet ? 18332 : 8332,
	user: conf.btcRpcUser,
	pass: conf.btcRpcPassword,
	timeout: 60000
});

module.exports = client;
