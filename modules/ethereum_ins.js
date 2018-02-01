/*jslint node: true */
'use strict';
const eventBus = require('byteballcore/event_bus');
const db = require('byteballcore/db.js');
const conf = require('byteballcore/conf');
const Web3 = require('web3');
let web3;
let needRescan = false;
let rescanning = false;

if (conf.ethEnabled) {
	web3 = new Web3(new Web3.providers.WebsocketProvider(conf.ethWSProvider));
}

let currentBlock;

async function start() {
	await web3.eth.subscribe('newBlockHeaders', async (err, res) => {
		await startScan(true);
	});
}

async function startScan(bCheckLast) {
	currentBlock = await web3.eth.getBlockNumber();
	let stopBlockNumber;
	if (bCheckLast) {
		stopBlockNumber = currentBlock - 1;
	}
	if (!stopBlockNumber) stopBlockNumber = currentBlock - 2000;
	if (stopBlockNumber <= 0) stopBlockNumber = 1;
	console.error('start scan');
	db.query("SELECT address AS byteball_address, receiving_address, device_address  \n\
			FROM receiving_addresses \n\
			JOIN user_addresses USING(device_address) \n\
			WHERE receiving_addresses.currency = 'ETH' AND user_addresses.platform = 'BYTEBALL'", async (rows) => {
		if (!rows.length)
			return console.log('ETH nothing to scan for');
		let rowsByAddress = {}
		rows.forEach(row => {
			rowsByAddress[row.receiving_address] = row;
		});
		while (currentBlock-- > stopBlockNumber) {
			let block = await web3.eth.getBlock(currentBlock, true);
			if (block && block.transactions && block.transactions.length) {
				block.transactions.forEach(transaction => {
					if (rowsByAddress[transaction.to]) {
						console.log('==== scan found a transaction', transaction);
						eventBus.emit('new_in_transaction', {
							txid: transaction.hash,
							currency_amount: transaction.value / 1e18,
							currency: 'ETH',
							device_address: rowsByAddress[transaction.to].device_address,
							byteball_address: rowsByAddress[transaction.to].byteball_address,
							receiving_address: rowsByAddress[transaction.to].receiving_address,
							block_number: block.number
						});
					}
				})
			}
		}
		console.error('stop scan')
		return true;
	})
}

if (conf.ethEnabled) {
	start().catch(e => console.error(e));
	setInterval(async () => {
		let lastBlockNumber = await web3.eth.getBlockNumber()
		db.query("SELECT * FROM transactions WHERE currency = 'ETH' AND stable = 0", (rows) => {
			rows.forEach(async (row) => {
				if ((lastBlockNumber - row.block_number) >= conf.ethMinConfirmations) {
					console.log('tx is stable');
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
}

setInterval(async () => {
	if (needRescan) {
		if (!(await web3.eth.isSyncing()) && !rescanning) {
			rescanning = true;
			await startScan().catch(e => {console.error(e)});
			rescanning = false;
			needRescan = false;
		}
	} else {
		if (await web3.eth.isSyncing()) {
			needRescan = true;
		}
	}
}, 60000);

exports.startScan = startScan;

exports.readOrAssignReceivingAddress = async (device_address, cb) => {
	const mutex = require('byteballcore/mutex.js');
	mutex.lock([device_address], unlock => {
		db.query("SELECT receiving_address FROM receiving_addresses WHERE device_address=? AND currency='ETH'", [device_address], async (rows) => {
			if (rows.length > 0) {
				cb(rows[0].receiving_address);
				return unlock();
			}
			mutex.lock(['new_ethereum_address'], async (new_addr_unlock) => {
				let receiving_address = await web3.eth.personal.newAccount(conf.ethPassword);
				db.query(
					"INSERT INTO receiving_addresses (receiving_address, currency, device_address) VALUES(?,?,?)",
					[receiving_address, 'ETH', device_address],
					() => {
						cb(receiving_address);
						new_addr_unlock();
						unlock();
					}
				);
			});
		});
	});
};


