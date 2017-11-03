/*jslint node: true */
'use strict';
const db = require('byteballcore/db');
const eventBus = require('byteballcore/event_bus');
const split = require('../modules/split.js');


function run(){
	async.series([splitOutputs, readStaticChangeAddress, refund], () => {
		console.error('==== Finished');
	});
}

function splitOutputs(onDone){
	split.checkAndSplitLargestOutput(null, err => {
		if (err)
			throw Error('split bytes failed: '+err);
		onDone();
	});
}

function readStaticChangeAddress(onDone){
	const headlessWallet = require('headless-byteball');
	headlessWallet.issueOrSelectStaticChangeAddress(address => {
		change_address = address;
		onDone();
	});
}

function refund(onDone) {
	const headlessWallet = require('headless-byteball');
	const walletGeneral = require('byteballcore/wallet_general.js');
	db.query(
		"SELECT transaction_id, currency, device_address, currency_amount, byteball_address \n\
		FROM transactions \n\
		LEFT JOIN outputs ON byteball_address=address AND ROUND(currency_amount*1e9)=outputs.amount AND asset IS NULL \n\
		LEFT JOIN unit_authors USING(unit) \n\
		LEFT JOIN my_addresses ON unit_authors.address=my_addresses.address \n\
		WHERE my_addresses.address IS NULL AND refunded=0 AND currency='GBYTE'", 
		rows => {
			if (!rows.length){
				console.error('==== nothing to refund');
				return onDone();
			}
			let arrRowSets = [];
			while (rows.length > 0)
				arrRowSets.push(rows.splice(0, constants.MAX_OUTPUTS_PER_PAYMENT_MESSAGE - 1));
			async.eachSeries(
				arrRowSets,
				(rows, cb) => {
					let outputs = rows.map(row => {
						return {amount: Math.round(row.currency_amount*1e9), address: row.byteball_address};
					});
					headlessWallet.sendPaymentUsingOutputs(null, outputs, change_address, (err, unit) => {
						if (err)
							throw Error('sendPaymentUsingOutputs failed: '+err);
						let arrTransactionIds = rows.map(row => row.transaction_id);
						db.query(
							"UPDATE transactions SET refunded=1, refund_date = " + db.getNow() + ", refund_unit=? WHERE transaction_id IN(?)", 
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



eventBus.on('headless_wallet_ready', run);
