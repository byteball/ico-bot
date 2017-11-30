/*jslint node: true */
'use strict';
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');
const eventBus = require('byteballcore/event_bus');
const headlessWallet = require('headless-byteball');
const texts = require('./texts');


headlessWallet.setupChatEventHandlers();


eventBus.on('paired', from_address => {
	let device = require('byteballcore/device.js');
	device.sendMessageToDevice(from_address, 'text', "The bot is in maintenance mode, please check again later.");
});

eventBus.on('text', (from_address, text) => {
	let device = require('byteballcore/device.js');
	device.sendMessageToDevice(from_address, 'text', "The bot is in maintenance mode, please check again later.");
});


eventBus.on('headless_wallet_ready', () => {
	let error = '';
	let arrTableNames = ['users', 'receiving_addresses', 'transactions'];
	db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN (?)", [arrTableNames], (rows) => {
		if (rows.length !== arrTableNames.length) error += texts.errorInitSql();

		if (conf.useSmtp && (!conf.smtpUser || !conf.smtpPassword || !conf.smtpHost)) error += texts.errorSmtp();

		//if (!conf.admin_email || !conf.from_email) error += texts.errorEmail();

		if (error)
			throw new Error(error);

	});
});
