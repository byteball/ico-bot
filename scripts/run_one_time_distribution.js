/*jslint node: true */
'use strict';
const constants = require('byteballcore/constants.js');
const db = require('byteballcore/db');
const eventBus = require('byteballcore/event_bus');
const conf = require('byteballcore/conf');
const async = require('async');
const conversion = require('../modules/conversion.js');

var change_address;

if (conf.rulesOfDistributionOfTokens !== 'one-time')
	throw Error('must be one-time');

function run(){
	async.series([readStaticChangeAddress, calcTokens, runOneTimeDistribution], () => {
		console.error('==== Finished');
	});
}

function readStaticChangeAddress(onDone){
	const headlessWallet = require('headless-byteball');
	headlessWallet.issueOrSelectStaticChangeAddress(address => {
		change_address = address;
		onDone();
	});
}

// do it all at once to ensure we use the same exchange rate for all records
function calcTokens(onDone){
	if (conf.exchangeRateDate === 'receipt-of-payment')
		return onDone();
	db.query("SELECT transaction_id, currency, currency_amount FROM transactions WHERE tokens IS NULL", rows => {
		async.eachSeries(
			rows,
			(row, cb) => {
				let tokens = conversion.convertCurrencyToTokens(row.currency_amount, row.currency);
				db.query("UPDATE transactions SET tokens=? WHERE transaction_id=?", [tokens, row.transaction_id], () => { cb(); });
			},
			onDone
		);
	});
}

function runOneTimeDistribution(onDone) {
	const headlessWallet = require('headless-byteball');
	const walletGeneral = require('byteballcore/wallet_general.js');
	db.query(
		"SELECT transaction_id, currency, device_address, currency_amount, tokens, byteball_address \n\
		FROM transactions \n\
		LEFT JOIN outputs ON byteball_address=outputs.address AND tokens=outputs.amount AND asset=? \n\
		LEFT JOIN unit_authors USING(unit) \n\
		LEFT JOIN my_addresses ON unit_authors.address=my_addresses.address \n\
		WHERE my_addresses.address IS NULL AND paid_out=0 AND tokens>0", 
		[conf.issued_asset],
		rows => {
			if (!rows.length){
				console.error('==== nothing to pay');
				return onDone();
			}
			let arrRowSets = [];
			while (rows.length > 0)
				arrRowSets.push(rows.splice(0, constants.MAX_OUTPUTS_PER_PAYMENT_MESSAGE - 1));
			async.eachSeries(
				arrRowSets,
				(rows, cb) => {
					let outputs = rows.map(row => {
						return {amount: row.tokens, address: row.byteball_address};
					});
					headlessWallet.sendPaymentUsingOutputs(conf.issued_asset, outputs, change_address, (err, unit) => {
						if (err)
							throw Error('sendPaymentUsingOutputs failed: '+err);
						let arrTransactionIds = rows.map(row => row.transaction_id);
						db.query(
							"UPDATE transactions SET paid_out=1, paid_date = " + db.getNow() + ", payout_unit=? WHERE transaction_id IN(?)", 
							[unit, arrTransactionIds],
							() => {
								rows.forEach(row => {
									if (row.device_address)
										walletGeneral.sendPaymentNotification(row.device_address, unit);
								});
								cb();
							}
						);
					});
				},
				onDone
			);
		}
	);
}


eventBus.once('headless_and_rates_ready', run);
