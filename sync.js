/*jslint node: true */
'use strict';
const conf = require('ocore/conf');
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const headlessWallet = require('headless-obyte');
const texts = require('./texts');


headlessWallet.setupChatEventHandlers();


eventBus.on('paired', from_address => {
	let device = require('ocore/device.js');
	device.sendMessageToDevice(from_address, 'text', "The bot is in maintenance mode, please check again later.");
});

eventBus.on('text', (from_address, text) => {
	let device = require('ocore/device.js');
	device.sendMessageToDevice(from_address, 'text', "The bot is in maintenance mode, please check again later.");
});


eventBus.on('headless_wallet_ready', () => {
	let error = '';
	let arrTableNames = ['user_addresses', 'receiving_addresses', 'transactions'];
	db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN (?)", [arrTableNames], (rows) => {
		if (rows.length !== arrTableNames.length) error += texts.errorInitSql();

		if (!conf.admin_email || !conf.from_email) error += texts.errorEmail();

		if (error)
			throw new Error(error);
		
		if (conf.bStaticChangeAddress)
			headlessWallet.issueOrSelectStaticChangeAddress(address => {
				console.log('==== static change address '+address);
			});

	});
});
