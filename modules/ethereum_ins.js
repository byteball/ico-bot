/*jslint node: true */
'use strict';
const eventBus = require('byteballcore/event_bus');
const db = require('byteballcore/db.js');
const conf = require('byteballcore/conf')
const Web3 = require('web3')
const fs = require('fs')

const web3 = new Web3(new Web3.providers.WebsocketProvider(conf.ethWSProvider));

let startBlock;
let currentBlock;
let scanComplete = false;
try {
	currentBlock = fs.readFileSync('./currentBlock');
} catch (e) {
	currentBlock = 0;
}

async function start() {
	startBlock = await web3.eth.getBlockNumber();
	if (currentBlock === 0) currentBlock = startBlock;
	await web3.eth.subscribe('pendingTransactions', async (err, res) => {
		let transaction = await web3.eth.getTransaction(res);
		if (!transaction) return;
		db.query("SELECT byteball_address, receiving_address, device_address  \n\
			FROM receiving_addresses \n\
			JOIN users USING(device_address) \n\
			WHERE receiving_address = ?", [transaction.to], rows => {
			if (!rows.length) return;
			eventBus.emit('new_in_transaction', {
				txid: res,
				currency_amount: transaction.value / 1e18,
				currency: 'ETH',
				device_address: rows[0].device_address,
				byteball_address: rows[0].byteball_address,
				receiving_address: rows[0].receiving_address
			});
		})
	});
}

async function startScan() {
	console.error('start scan')
	db.query("SELECT byteball_address, receiving_address, device_address  \n\
			FROM receiving_addresses \n\
			JOIN users USING(device_address) \n\
			WHERE currency = 'ETH'", async (rows) => {
		if (!rows.length) return;
		let assocRowToAddress = {}
		let addresses = rows.map(row => {
			assocRowToAddress[row.receiving_address] = row;
			return row.receiving_address;
		});
		for (; currentBlock < startBlock; currentBlock++) {
			let block = await web3.eth.getBlock(currentBlock, true);
			if (block && block.transactions && block.transactions.length) {
				block.transactions.forEach(transaction => {
					if (addresses.indexOf(transaction.to) !== -1) {
						eventBus.emit('new_in_transaction', {
							txid: transaction.hash,
							currency_amount: transaction.value / 1e18,
							currency: 'ETH',
							device_address: assocRowToAddress[transaction.to].device_address,
							byteball_address: assocRowToAddress[transaction.to].byteball_address,
							receiving_address: assocRowToAddress[transaction.to].receiving_address
						});
					}
				})
			}
		}
		scanComplete = true;
	})
	setInterval(async () => {
		if (scanComplete) {
			fs.writeFile('./currentBlock', await web3.eth.getBlockNumber(), () => {
			})
		}
	}, 30000)
}

start().catch(e => console.error(e))

setInterval(async () => {
	db.query("SELECT * FROM transactions WHERE currency = 'ETH' AND stable = 0", (rows) => {
		rows.forEach(async (row) => {
			let stableTx = await web3.eth.getTransactionReceipt(row.txid);
			if (stableTx) {
				eventBus.emit('in_transaction_stable', {
					txid: row.txid,
					currency_amount: row.currency_amount,
					currency: 'ETH',
					byteball_address: row.byteball_address,
					device_address: row.device_address,
					receiving_address: row.receiving_address
				});
			}
		})
	});
}, 10000);

exports.startScan = startScan;

exports.readOrAssignReceivingAddress = async (device_address, cb) => {
	const mutex = require('byteballcore/mutex.js');
	mutex.lock([device_address], unlock => {
		db.query("SELECT receiving_address FROM receiving_addresses WHERE device_address=? AND currency='ETH'", [device_address], async (rows) => {
			if (rows.length > 0) {
				cb(rows[0].receiving_address);
				return unlock();
			}
			let receiving_address = await web3.eth.personal.newAccount(conf.ethPassword);
			db.query(
				"INSERT INTO receiving_addresses (receiving_address, currency, device_address) VALUES(?,?,?)",
				[receiving_address, 'ETH', device_address],
				() => {
					cb(receiving_address);
					unlock();
				}
			);
		});
	});
};


