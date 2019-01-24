/*jslint node: true */
'use strict';
const eventBus = require('ocore/event_bus');
const conf = require('ocore/conf');
const split = require('../modules/split.js');

if (!conf.issued_asset)
	throw Error("please isssue the asset first by running scripts/issue_tokens.js");

function splitOutputs(){
	split.checkAndSplitLargestOutput(conf.issued_asset, err => {
		if (err)
			throw Error('split '+conf.issued_asset+' failed: '+err);
		split.checkAndSplitLargestOutput(null, err => {
			if (err)
				throw Error('split bytes failed: '+err);
			console.error('==== split done');
		});
	});
}

eventBus.on('headless_wallet_ready', splitOutputs);
