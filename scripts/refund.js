/*jslint node: true */
'use strict';
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const async = require('async');
const conf = require('ocore/conf');
const Web3 = require('web3');
const bitcoinClient = require('../modules/bitcoin_client.js');
const headlessWallet = require('headless-obyte');
let web3;

const MAX_BTC_OUTPUTS_PER_PAYMENT_MESSAGE = 100;

if (conf.ethEnabled) {
	web3 = new Web3(new Web3.providers.WebsocketProvider(conf.ethWSProvider));
}

let change_address;

function run() {
	async.series([readStaticChangeAddress, refundBytes], (err) => {
		if (err) return console.error(err);
		console.error('==== Obyte Finished');
	});

	if (conf.ethEnabled) {
		refundEther().then(() => {
			console.error('==== Ethereum Finished');
		}).catch(e => console.error(e))
	}
}


function readStaticChangeAddress(onDone) {
	const headlessWallet = require('headless-obyte');
	headlessWallet.issueOrSelectStaticChangeAddress(address => {
		change_address = address;
		onDone();
	});
}

function refundBytes(onDone) {
	const headlessWallet = require('headless-obyte');
	const walletGeneral = require('ocore/wallet_general.js');
	db.query(
		"SELECT transaction_id, currency, device_address, currency_amount, byteball_address \n\
		FROM transactions \n\
		LEFT JOIN outputs ON byteball_address=address AND ROUND(currency_amount*1e9)=outputs.amount AND asset IS NULL \n\
		LEFT JOIN unit_authors USING(unit) \n\
		LEFT JOIN my_addresses ON unit_authors.address=my_addresses.address \n\
		WHERE my_addresses.address IS NULL AND refunded=0 AND currency='GBYTE'",
		rows => {
			if (!rows.length) {
				console.error('==== GBYTE nothing to refund');
				return onDone();
			}
			let arrRowSets = [];
			while (rows.length > 0)
				arrRowSets.push(rows.splice(0, constants.MAX_OUTPUTS_PER_PAYMENT_MESSAGE - 1));
			async.eachSeries(
				arrRowSets,
				(rows, cb) => {
					let outputs = rows.map(row => {
						return {amount: Math.round(row.currency_amount * 1e9), address: row.byteball_address};
					});
					headlessWallet.sendPaymentUsingOutputs(null, outputs, change_address, (err, unit) => {
						if (err)
							throw Error('sendPaymentUsingOutputs failed: ' + err);
						let arrTransactionIds = rows.map(row => row.transaction_id);
						db.query(
							"UPDATE transactions SET refunded=1, refund_date = " + db.getNow() + ", refund_txid=? WHERE transaction_id IN(?)",
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

function refundEther() {
	const device = require('ocore/device.js');
	return new Promise((resolve, reject) => {
		db.query("SELECT transaction_id, SUM(currency_amount) AS currency_amount, user_addresses.address, receiving_address, device_address FROM transactions JOIN user_addresses USING(device_address) WHERE transactions.currency = 'ETH' AND refunded = 0 AND stable = 1 AND user_addresses.platform='ETHEREUM' GROUP BY receiving_address", async (rows) => {
			if (!rows.length) {
				console.error('==== ETH nothing to refund');
				return resolve();
			}
			console.error('==== start Ethereum refund');
			await web3.eth.personal.unlockAccount(conf.ethRefundDistributionAddress, conf.ethPassword, 10000000);
			return async.each(rows, (row, callback) => {
				web3.eth.sendTransaction({
					from: conf.ethRefundDistributionAddress,
					to: row.address,
					value: web3.utils.toWei(row.currency_amount.toString(), 'ether'),
					gas: 21000
				}, (err, txid) => {
					if (err) return callback(err);
					db.query("UPDATE transactions SET refunded=1, refund_date = " + db.getNow() + ", refund_txid=? WHERE receiving_address = ?",
						[txid, row.receiving_address],
						() => {
							if (row.device_address)
								device.sendMessageToDevice(row.device_address, 'text', "Refunded "+row.currency_amount+" ETH");
							return callback();
						})
				});
			}, (err) => {
				if (err) return reject(err);
				return resolve();
			});
		});
	});
}

function refundBtc(onDone) {
	const device = require('ocore/device.js');
	db.query(
		"SELECT transaction_id, currency_amount, user_addresses.address, device_address \n\
		FROM transactions JOIN user_addresses USING(device_address) \n\
		WHERE transactions.currency = 'BTC' AND refunded = 0 AND stable = 1 AND user_addresses.platform='BITCOIN'",
		rows => {
			if (!rows.length) {
				console.error('==== BTC nothing to refund');
				return onDone();
			}
			let arrRowSets = [];
			while (rows.length > 0)
				arrRowSets.push(rows.splice(0, MAX_BTC_OUTPUTS_PER_PAYMENT_MESSAGE));
			async.eachSeries(
				arrRowSets,
				(rows, cb) => {
					let outputs = {};
					rows.forEach(row => {
						outputs[row.address] = row.currency_amount;
					});
					console.log("refunding to "+JSON.stringify(outputs));
					bitcoinClient.sendMany("", outputs, (err, txid) => {
						console.log('BTC refund to '+JSON.stringify(outputs)+': txid '+txid+', err '+err);
						if (err)
							throw Error('BTC refund to '+JSON.stringify(outputs)+' failed: '+err);
						let arrTransactionIds = rows.map(row => row.transaction_id);
						db.query(
							"UPDATE transactions SET refunded=1, refund_date = " + db.getNow() + ", refund_txid=? WHERE transaction_id IN(?)",
							[txid, arrTransactionIds],
							() => {
								rows.forEach(row => {
									if (row.device_address)
										device.sendMessageToDevice(row.device_address, 'text', "Refunded "+row.currency_amount+" BTC");
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
