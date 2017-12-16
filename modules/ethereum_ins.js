/*jslint node: true */
'use strict';
const eventBus = require('byteballcore/event_bus');
const db = require('byteballcore/db.js');
const conf = require('byteballcore/conf');
const Web3 = require('web3');
let web3;
let needRescan = false;
let rescan = false;

if (conf.ethEnabled) {
	web3 = new Web3(new Web3.providers.WebsocketProvider(conf.ethWSProvider));
}

let currentBlock;

async function start() {
	await web3.eth.subscribe('pendingTransactions', async (err, res) => {
		let transaction = await web3.eth.getTransaction(res);
		if (!transaction) return;
		db.query("SELECT address as byteball_address, receiving_address, device_address  \n\
			FROM receiving_addresses \n\
			JOIN user_addresses USING(device_address) \n\
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
	currentBlock = await web3.eth.getBlockNumber();
	db.query("SELECT txid FROM transactions WHERE currency = 'ETH' ORDER BY transaction_id DESC LIMIT 1", async (rows) => {
		let stopBlockNumber;
		if (rows.length) stopBlockNumber = (await web3.eth.getTransaction(rows[0].txid).catch(e => console.error(e))).blockNumber - 2;
		if (!stopBlockNumber) stopBlockNumber = currentBlock - 1000;
		if (stopBlockNumber <= 0) stopBlockNumber = 1;
		console.error('start scan')
		db.query("SELECT address as byteball_address, receiving_address, device_address  \n\
			FROM receiving_addresses \n\
			JOIN user_addresses USING(device_address) \n\
			WHERE receiving_addresses.currency = 'ETH' AND user_addresses.platform = 'Byteball'", async (rows) => {
			if (!rows.length) return;
			let rowsByAddress = {}
			rows.forEach(row => {
				rowsByAddress[row.receiving_address] = row;
			});
			while (currentBlock-- > stopBlockNumber) {
				let block = await web3.eth.getBlock(currentBlock, true);
				if (block && block.transactions && block.transactions.length) {
					block.transactions.forEach(transaction => {
						if (rowsByAddress[transaction.to]) {
							eventBus.emit('new_in_transaction', {
								txid: transaction.hash,
								currency_amount: transaction.value / 1e18,
								currency: 'ETH',
								device_address: rowsByAddress[transaction.to].device_address,
								byteball_address: rowsByAddress[transaction.to].byteball_address,
								receiving_address: rowsByAddress[transaction.to].receiving_address
							});
						}
					})
				}
			}
			console.error('stop scan')
			return true;
		})
	});
}

if (conf.ethEnabled) {
	start().catch(e => console.error(e));
	setInterval(async () => {
		let lastBlockNumber = await web3.eth.getBlockNumber()
		db.query("SELECT * FROM transactions WHERE currency = 'ETH' AND stable = 0", (rows) => {
			rows.forEach(async (row) => {
				let stableTx = await web3.eth.getTransactionReceipt(row.txid);
				if (stableTx && (lastBlockNumber - stableTx.blockNumber) >= conf.minConfirmations) {
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
		if (!(await web3.eth.isSyncing()) && !rescan) {
			rescan = true;
			await startScan().catch(e => {console.error(e)});
			rescan = false;
			needRescan = false;
		}
	}else{
		if(await web3.eth.isSyncing()){
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


