/*jslint node: true */
'use strict';
const fs = require('fs');
const _ = require('lodash');
const eventBus = require('ocore/event_bus');
const db = require('ocore/db.js');
const conf = require('ocore/conf');
const bitcoinClient = require('./bitcoin_client.js');
const desktopApp = require('ocore/desktop_app.js');

const appDataDir = desktopApp.getAppDataDir();
const LAST_BLOCK_HASH_FILENAME = appDataDir + '/' + (conf.LAST_BLOCK_HASH_FILENAME || 'last_bitcoin_block_hash');

let currentBlock;
let lastBlockHash = null;
let assocKnownTxIds = {};

function readCurrentHeight(handleCurrentHeight){
	bitcoinClient.getBlockCount(function(err, height){
		if (err)
			throw Error("getBlockCount failed: "+err);
		handleCurrentHeight(height);
	});
}

/*
function readCurrentHeight2(handleCurrentHeight){
	bitcoinClient.getInfo(function(err, currentInfo){
		if (err)
			throw Error("getInfo failed: "+err);
		handleCurrentHeight(currentInfo.blocks);
	});
}

function readCurrentBlockHash(handleCurrentBlockHash){
	bitcoinClient.getBestBlockHash(function(err, hash){
		if (err)
			throw Error("getBestBlockHash failed: "+err);
		handleCurrentBlockHash(hash);
	});
}
*/

function readCountConfirmations(txid, handleCountConfirmations){
	bitcoinClient.getTransaction(txid, function(err, info) {
		if (err){
			console.log("readCountConfirmations: getTransaction "+txid+" failed: "+err);
			return handleCountConfirmations();
		}
		console.log('getTransaction: ', info);
		handleCountConfirmations(info.confirmations);
	});
}
	
function checkForNewTransactions(){
	bitcoinClient.listSinceBlock(lastBlockHash, conf.btcMinConfirmations, (err, response) => {
		if (err)
			return console.log('listSinceBlock '+lastBlockHash+' failed: '+err);
		lastBlockHash = response.lastblock;
		let arrTransactions = response.transactions.filter(tx => tx.category === 'receive' && !assocKnownTxIds[tx.txid]);
		if (arrTransactions.length === 0)
			return console.log("no new txs");
		let arrTxids = arrTransactions.map(tx => tx.txid);
		db.query("SELECT txid FROM transactions WHERE currency='BTC' AND stable=0 AND txid IN("+arrTxids.map(db.escape).join(', ')+")", rows => {
			let arrKnownTxIds = rows.map(row => row.txid);
			arrKnownTxIds.forEach(txid => {
				assocKnownTxIds[txid] = true;
			});
			let arrNewTxids = _.difference(arrTxids, arrKnownTxIds);
			if (arrNewTxids.length === 0)
				return console.log("no new txs after filtering through the db");
			arrTransactions.forEach(tx => {
				if (arrNewTxids.indexOf(tx.txid) < 0)
					return;
				assocKnownTxIds[tx.txid] = true;
				db.query(
					"SELECT address AS obyte_address, receiving_address, device_address \n\
					FROM receiving_addresses \n\
					JOIN user_addresses USING(device_address) \n\
					WHERE receiving_address = ? AND receiving_addresses.currency='BTC' AND user_addresses.platform='BYTEBALL'",
					[tx.address],
					tx_rows => {
						if (tx_rows.length > 1)
							throw Error("more than 1 record by receiving address "+tx.address);
						if (tx_rows.length === 0)
							return console.log("received "+tx.amount+" BTC to "+tx.address+" but it is not our receiving address");
						let tx_row = tx_rows[0];
						eventBus.emit( (tx.confirmations < conf.btcMinConfirmations) ? 'new_in_transaction' : 'in_transaction_stable', {
							txid: tx.txid,
							currency_amount: tx.amount,
							currency: 'BTC',
							device_address: tx_row.device_address,
							obyte_address: tx_row.obyte_address,
							receiving_address: tx_row.receiving_address
						});
					}
				);
			});
		});
	});
}


function checkUnconfirmedTransactions(){
	db.query("SELECT * FROM transactions WHERE currency = 'BTC' AND stable = 0", rows => {
		rows.forEach(async (row) => {
			console.log('checking for stability of', row.txid);
			readCountConfirmations(row.txid, count_confirmations => {
				if (count_confirmations < conf.btcMinConfirmations) // undefined or number
					return;
				console.log('tx '+row.txid+' is stable');
				delete assocKnownTxIds[row.txid];
				eventBus.emit('in_transaction_stable', {
					txid: row.txid,
					currency_amount: row.currency_amount,
					currency: 'BTC',
					obyte_address: row.byteball_address,
					device_address: row.device_address,
					receiving_address: row.receiving_address
				});
			});
		});
	});
}

function checkForNewBlock(){
	readCurrentHeight(newCurrentBlock => {
		if (newCurrentBlock === currentBlock)
			return;
		currentBlock = newCurrentBlock;
		checkUnconfirmedTransactions();
		if (!lastBlockHash)
			return console.log('no last block hash yet, not saving');
		fs.writeFile(LAST_BLOCK_HASH_FILENAME, lastBlockHash, 'utf8', function(err){
			if (err)
				throw Error("failed to write last block hash file");
			console.log('saved last block hash '+lastBlockHash);
		});
	});
}

// read last block hash from disk
function initLastBlockHash(onDone){
	fs.readFile(LAST_BLOCK_HASH_FILENAME, 'utf8', function(err, data){
		if (err){
			console.log("no last block hash");
			return onDone();
		}
		lastBlockHash = data;
		console.log('last BTC block hash '+lastBlockHash);
		onDone();
	});
}

if (conf.btcEnabled) {
	initLastBlockHash(() => {
		setInterval(checkForNewBlock, 60*1000);
		setInterval(checkForNewTransactions, 10*1000);
	});
}

exports.readOrAssignReceivingAddress = async (device_address, cb) => {
	const mutex = require('ocore/mutex.js');
	mutex.lock([device_address], unlock => {
		db.query("SELECT receiving_address FROM receiving_addresses WHERE device_address=? AND currency='BTC'", [device_address], async (rows) => {
			if (rows.length > 0) {
				cb(rows[0].receiving_address);
				return unlock();
			}
			mutex.lock(['new_bitcoin_address'], new_addr_unlock => {
				bitcoinClient.getNewAddress(function(err, receiving_address) {
					if (err)
						throw Error(err);
					db.query(
						"INSERT INTO receiving_addresses (receiving_address, currency, device_address) VALUES(?,?,?)",
						[receiving_address, 'BTC', device_address],
						() => {
							cb(receiving_address);
							new_addr_unlock();
							unlock();
						}
					);
				});
			});
		});
	});
};


