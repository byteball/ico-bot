/*jslint node: true */
'use strict';
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');

function splitLargestOutput(asset, onDone){
	console.error('will split largest output of asset '+asset);
	const headlessWallet = require('headless-obyte');
	createSplitOutputsAndAddress(asset, function(arrOutputs, address){
		headlessWallet.sendPaymentUsingOutputs(asset, arrOutputs, address, (err, unit) => {
			if (err)
				return onDone(err);
			console.error('largest output of asset '+asset+' is now split, will wait for stability');
			eventBus.once('my_stable-'+unit, () => {
				console.error('split of asset '+asset+' is now stable');
				onDone();
			});
		});
	});
}

function createSplitOutputsAndAddress(asset, handleOutputs){
	let asset_cond = asset ? "asset="+db.escape(asset) : "asset IS NULL";
	db.query(
		"SELECT amount, address FROM outputs JOIN my_addresses USING(address) JOIN units USING(unit) \n\
		WHERE "+asset_cond+" AND is_spent=0 AND is_stable=1 ORDER BY amount DESC LIMIT 1", 
		function(rows){
			if (rows.length === 0)
				throw Error("nothing to split");
			let amount = rows[0].amount;
			let address = rows[0].address;
			const COUNT_CHUNKS = 100;
			let chunk_amount = Math.round(amount/COUNT_CHUNKS);
			let arrOutputs = [];
			for (var i=1; i<COUNT_CHUNKS; i++) // 99 iterations
				arrOutputs.push({amount: chunk_amount, address: address});
			handleOutputs(arrOutputs, address);
		}
	);
}

function checkAndSplitLargestOutput(asset, onDone){
	let asset_cond = asset ? "asset="+db.escape(asset) : "asset IS NULL";
	db.query( // see if the largest output is greater than the 1/10th of the total
		"SELECT COUNT(*) AS count FROM outputs JOIN my_addresses USING(address) JOIN units USING(unit) \n\
		WHERE is_spent=0 AND is_stable=1 AND "+asset_cond+" \n\
			AND amount>( \n\
				SELECT SUM(amount) FROM outputs JOIN my_addresses USING(address) JOIN units USING(unit) \n\
				WHERE is_spent=0 AND is_stable=1 AND "+asset_cond+" \n\
			)/10", 
		rows => {
			if (rows[0].count > 0)
				splitLargestOutput(asset, onDone);
			else
				onDone();
		}
	);
}

exports.checkAndSplitLargestOutput = checkAndSplitLargestOutput;
