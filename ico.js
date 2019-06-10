/*jslint node: true */
'use strict';
const _ = require('lodash');
const moment = require('moment');
const constants = require('ocore/constants.js');
const conf = require('ocore/conf');
const db = require('ocore/db');
const eventBus = require('ocore/event_bus');
const texts = require('./texts');
const validationUtils = require('ocore/validation_utils');
const privateProfile = require('ocore/private_profile.js');
const notifications = require('./modules/notifications');
const obyte_ins = require('./modules/obyte_ins');
const ethereum_ins = require('./modules/ethereum_ins');
const bitcoin_ins = require('./modules/bitcoin_ins');
const bitcoinClient = require('./modules/bitcoin_client.js');
const bitcoinApi = require('./modules/bitcoin_api.js');
const conversion = require('./modules/conversion-and-headless.js');
const discounts = require('./modules/discounts.js');
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const bitcore = require('bitcore-lib');
const { spawn } = require('child_process');
const fs = require('fs');
const desktopApp = require('ocore/desktop_app.js');

let web3;

const bTestnet = constants.version.match(/t$/);
const bitcoinNetwork = bTestnet ? bitcore.Networks.testnet : bitcore.Networks.livenet;

process.on('unhandledRejection', up => { throw up; });

if (!conf.issued_asset)
	throw Error("please isssue the asset first by running scripts/issue_tokens.js");

if (conf.ethEnabled) {
	web3 = new Web3(new Web3.providers.WebsocketProvider(conf.ethWSProvider));
}


conversion.enableRateUpdates();

function sendTokensToUser(objPayment) {
	const mutex = require('ocore/mutex');
	mutex.lock(['tx-' + objPayment.transaction_id], unlock => {
		db.query("SELECT paid_out FROM transactions WHERE transaction_id=?", [objPayment.transaction_id], rows => {
			if (rows.length === 0)
				throw Error('tx ' + objPayment.transaction_id + ' not found');
			if (rows[0].paid_out)
				return unlock();
			const headlessWallet = require('headless-obyte');
			headlessWallet.issueChangeAddressAndSendPayment(
				conf.issued_asset, objPayment.tokens, objPayment.byteball_address || objPayment.obyte_address, objPayment.device_address,
				(err, unit) => {
					if (err) {
						notifications.notifyAdmin('sendTokensToUser ICO failed', err + "\n\n" + JSON.stringify(objPayment, null, '\t'));
						return unlock();
					}
					db.query(
						"UPDATE transactions SET paid_out = 1, paid_date = " + db.getNow() + ", payout_unit=? WHERE transaction_id = ? AND paid_out = 0",
						[unit, objPayment.transaction_id],
						() => {
							unlock();
						}
					);
				}
			);
		});
	});
}

function updatePricesInConf(){
	var appDataDir = desktopApp.getAppDataDir();
	var userConfFile = appDataDir + '/conf.json';
	var json = require(userConfFile);
	json.assocPrices = conf.assocPrices;
	fs.writeFile(userConfFile, JSON.stringify(json, null, '\t'), 'utf8', function(err){
		if (err)
			throw Error('failed to write conf.json: '+err);
	});
}

async function convertCurrencyToTokensWithDiscount(obyte_address, amount, currency){
	let objDiscount = await discounts.getDiscount(obyte_address);
	let tokens = conversion.convertCurrencyToTokens(amount, currency);
	tokens = Math.round(tokens / (1-objDiscount.discount/100));
	let objTokensWithDiscount = objDiscount;
	objTokensWithDiscount.tokens = tokens;
	return objTokensWithDiscount;
}

eventBus.on('paired', from_address => {
	let device = require('ocore/device.js');
	var text = texts.greeting();
	checkUserAdress(from_address, 'BYTEBALL', obyte_address => {
		if (obyte_address)
			text += "\n\n" + texts.howmany();
		else
			text += "\n\n" + texts.insertMyAddress();
		device.sendMessageToDevice(from_address, 'text', text);
	});
});

eventBus.once('headless_and_rates_ready', () => {
	const headlessWallet = require('headless-obyte');
	headlessWallet.setupChatEventHandlers();
	eventBus.on('text', (from_address, text) => {
		let device = require('ocore/device');
		text = text.trim();
		let ucText = text.toUpperCase();
		let lcText = text.toLowerCase();
		
		if (conf.arrAdminAddresses && conf.arrAdminAddresses.indexOf(from_address) >= 0){
			let objPrice = conf.assocPrices['all'];
			if (objPrice){
				if (lcText === 'admin')
					return device.sendMessageToDevice(from_address, 'text', 'Admin commands:\nset price <new price of '+conf.tokenName+' in '+objPrice.price_currency+'>\n(current price is '+(objPrice.price * conversion.displayTokensMultiplier)+')');
				let arrMatches = lcText.match(/set\s+price\s+([\d.]+)/);
				if (arrMatches){
					let display_price = parseFloat(arrMatches[1]);
					let price = display_price / conversion.displayTokensMultiplier;
					objPrice.price = price;
					updatePricesInConf();
					return device.sendMessageToDevice(from_address, 'text', 'The price is set to '+display_price+" "+conf.tokenName+"/"+objPrice.price_currency);
				}
			}
		}

		if (moment() < moment(conf.startDate, 'DD.MM.YYYY hh:mm'))
			return device.sendMessageToDevice(from_address, 'text', 'The ICO has not begun yet.');
		if (moment() > moment(conf.endDate, 'DD.MM.YYYY hh:mm'))
			return device.sendMessageToDevice(from_address, 'text', 'The ICO is already over.');

		let arrProfileMatches = text.match(/\(profile:(.+?)\)/);
		
		checkUserAdress(from_address, 'BYTEBALL', async (obyte_address) => {
			if (!obyte_address && !validationUtils.isValidAddress(ucText) && !arrProfileMatches)
				return device.sendMessageToDevice(from_address, 'text', texts.insertMyAddress());
			
			async function handleUserAddress(address, bWithData){
				function saveObyteAddress(){
					db.query(
						'INSERT OR REPLACE INTO user_addresses (device_address, platform, address) VALUES(?,?,?)', 
						[from_address, 'BYTEBALL', address], 
						async () => {
							device.sendMessageToDevice(from_address, 'text', 'Saved your Obyte address'+(bWithData ? ' and personal data' : '')+'.\n\n' + texts.howmany());
							let objDiscount = await discounts.getDiscount(address);
							if (objDiscount.discount)
								device.sendMessageToDevice(from_address, 'text', texts.discount(objDiscount));
						}
					);
				}
				if (conf.bLight && (conf.bRequireNonUs || conf.bRequireAccredited)){
					const light_attestations = require('./modules/light_attestations.js');
					await light_attestations.updateAttestationsInLight(address);
				}
				// check non-US attestation
				if (conf.bRequireNonUs){
					db.query(
						"SELECT 1 FROM attestations CROSS JOIN unit_authors USING(unit) WHERE attestations.address=? AND unit_authors.address IN(?)", 
						[address, conf.arrNonUsAttestors],
						rows => {
							if (rows.length === 0)
								return device.sendMessageToDevice(from_address, 'text', 'This token is available only to non-US citizens and residents but the address you provided is not attested as belonging to a non-US user.  If you are a non-US user and have already attested another address, please use the attested address.  If you are a non-US user and didn\'t attest yet, find "Real name attestation bot" in the Bot Store and have your address attested.');
							saveObyteAddress();
						}
					);
				}
				// check accredited investor
				else if (conf.bRequireAccredited){
					db.query(
						"SELECT 1 FROM attestations CROSS JOIN unit_authors USING(unit) WHERE attestations.address=? AND unit_authors.address IN(?)", 
						[address, conf.arrAccreditedAttestors],
						rows => {
							if (rows.length === 0)
								return device.sendMessageToDevice(from_address, 'text', 'This token is available only to accredited investors but the address you provided is not attested as belonging to an accredited investor.  If you are an accredited investor and have already attested another address, please use the attested address.  If you are an accredited investor and didn\'t attest yet, find "Accredited investor attestation bot" in the Bot Store and have your address attested.');
							saveObyteAddress();
						}
					);
				}
				else
					saveObyteAddress();
			}
			
			if (validationUtils.isValidAddress(ucText)) {
				if (conf.bRequireRealName)
					return device.sendMessageToDevice(from_address, 'text', "You have to provide your attested profile, just Obyte address is not enough.");
				return handleUserAddress(ucText);
			}
			else if (arrProfileMatches){
				let privateProfileJsonBase64 = arrProfileMatches[1];
				if (!conf.bRequireRealName)
					return device.sendMessageToDevice(from_address, 'text', "Private profile is not required");
				let objPrivateProfile = privateProfile.getPrivateProfileFromJsonBase64(privateProfileJsonBase64);
				if (!objPrivateProfile)
					return device.sendMessageToDevice(from_address, 'text', "Invalid private profile");
				privateProfile.parseAndValidatePrivateProfile(objPrivateProfile, function(err, address, attestor_address){
					if (err)
						return device.sendMessageToDevice(from_address, 'text', "Failed to parse the private profile: "+err);
					if (conf.arrRealNameAttestors.indexOf(attestor_address) === -1)
						return device.sendMessageToDevice(from_address, 'text', "We don't recognize the attestor "+attestor_address+" who attested your profile.  The only trusted attestors are: "+conf.arrRealNameAttestors.join(', '));
					let assocPrivateData = privateProfile.parseSrcProfile(objPrivateProfile.src_profile);
					let arrMissingFields = _.difference(conf.arrRequiredPersonalData, Object.keys(assocPrivateData));
					if (arrMissingFields.length > 0)
						return device.sendMessageToDevice(from_address, 'text', "These fields are missing in your profile: "+arrMissingFields.join(', '));
					privateProfile.savePrivateProfile(objPrivateProfile, address, attestor_address);
					handleUserAddress(address, true);
				});
				return;
			}
			else if (conf.ethEnabled && web3 && web3.utils.isAddress(lcText)) {
				db.query('INSERT OR REPLACE INTO user_addresses (device_address, platform, address) VALUES(?,?,?)', [from_address, 'ETHEREUM', lcText], () => {
					device.sendMessageToDevice(from_address, 'text', 'Saved your Ethereum address.');
				});
				return;
			}
			else if (conf.btcEnabled && bitcore.Address.isValid(text, bitcoinNetwork)) {
				db.query('INSERT OR REPLACE INTO user_addresses (device_address, platform, address) VALUES(?,?,?)', [from_address, 'BITCOIN', text], () => {
					device.sendMessageToDevice(from_address, 'text', 'Saved your Bitcoin address.');
				});
				return;
			}
			else if (/^[0-9.]+[\sA-Z]+$/.test(ucText)) {
				let amount = parseFloat(ucText.match(/^([0-9.]+)[\sA-Z]+$/)[1]);
				let currency = ucText.match(/[A-Z]+$/)[0];
				if (amount < 0.000000001)
					return device.sendMessageToDevice(from_address, 'text', 'Min amount 0.000000001');
				let objTokensWithDiscount, tokens, display_tokens;
				switch (currency) {
					case 'GB':
					case 'GBYTE':
						let bytes = Math.round(amount * 1e9);
						objTokensWithDiscount = await convertCurrencyToTokensWithDiscount(obyte_address, amount, 'GBYTE');
						tokens = objTokensWithDiscount.tokens;
						if (tokens === 0)
							return device.sendMessageToDevice(from_address, 'text', 'The amount is too small');
						display_tokens = tokens / conversion.displayTokensMultiplier;
						obyte_ins.readOrAssignReceivingAddress(from_address, receiving_address => {
							let response = 'You buy: ' + display_tokens + ' ' + conf.tokenName +
								'\n[' + ucText + '](byteball:' + receiving_address + '?amount=' + bytes + ')';
							if (objTokensWithDiscount.discount)
								response += "\n\n"+texts.includesDiscount(objTokensWithDiscount);
							device.sendMessageToDevice(from_address, 'text', response);
						});
						break;
					case 'ETHER':
						currency = 'ETH';
					case 'ETH':
					case 'BTC':
						objTokensWithDiscount = await convertCurrencyToTokensWithDiscount(obyte_address, amount, currency);
						tokens = objTokensWithDiscount.tokens;
						if (tokens === 0)
							return device.sendMessageToDevice(from_address, 'text', 'The amount is too small');
						display_tokens = tokens / conversion.displayTokensMultiplier;
						let currency_ins = (currency === 'BTC') ? bitcoin_ins : ethereum_ins;
						if ( (conf.ethEnabled && currency === 'ETH') || (conf.btcEnabled && currency === 'BTC') ) {
							currency_ins.readOrAssignReceivingAddress(from_address, receiving_address => {
								let response = 'You buy: ' + display_tokens + ' ' + conf.tokenName + '.' +
									'\nPlease send ' + amount + ' ' + currency + ' to ' + receiving_address;
								if (objTokensWithDiscount.discount)
									response += "\n\n"+texts.includesDiscount(objTokensWithDiscount);
								device.sendMessageToDevice(from_address, 'text', response);
							});
							break;
						}
					case 'USDT':
						device.sendMessageToDevice(from_address, 'text', currency + ' not implemented yet');
						break;
					default:
						device.sendMessageToDevice(from_address, 'text', 'Currency is not supported');
						break;
				}
				return;
			}

			let response = texts.greeting();
			if (obyte_address)
				response += "\n\n" + texts.howmany();
			else
				response += "\n\n" + texts.insertMyAddress();
			device.sendMessageToDevice(from_address, 'text', response);
		});
	});
});

function checkAndPayNotPaidTransactions() {
	let network = require('ocore/network.js');
	if (network.isCatchingUp())
		return;
	console.log('checkAndPayNotPaidTransactions');
	db.query(
		"SELECT transactions.* \n\
		FROM transactions \n\
		LEFT JOIN outputs ON byteball_address=outputs.address AND tokens=outputs.amount AND asset=? \n\
		LEFT JOIN unit_authors USING(unit) \n\
		LEFT JOIN my_addresses ON unit_authors.address=my_addresses.address \n\
		WHERE my_addresses.address IS NULL AND paid_out=0 AND stable=1",
		[conf.issued_asset],
		rows => {
			rows.forEach(sendTokensToUser);
		}
	);
}


function checkUserAdress(device_address, platform, cb) {
	db.query("SELECT address FROM user_addresses WHERE device_address = ? AND platform = ?", [device_address, platform.toUpperCase()], rows => {
		if (rows.length) {
			cb(rows[0].address)
		} else {
			cb(false)
		}
	});
}

// send collected bytes to the accumulation address
function sendMeBytes() {
	if (!conf.accumulationAddresses.GBYTE || !conf.minBalance)
		return console.log('Obyte no accumulation settings');
	let network = require('ocore/network.js');
	if (network.isCatchingUp())
		return console.log('still catching up, will not accumulate');
	console.log('will accumulate');
	db.query(
		"SELECT address, SUM(amount) AS amount \n\
		FROM my_addresses CROSS JOIN outputs USING(address) JOIN units USING(unit) \n\
		WHERE is_spent=0 AND asset IS NULL AND is_stable=1 \n\
		GROUP BY address ORDER BY amount DESC LIMIT ?",
		[constants.MAX_AUTHORS_PER_UNIT],
		rows => {
			let amount = rows.reduce((sum, row) => sum + row.amount, 0) - conf.minBalance;
			if (amount < 1000) // including negative
				return console.log("nothing to accumulate");
			const headlessWallet = require('headless-obyte');
			headlessWallet.issueChangeAddressAndSendPayment(null, amount, conf.accumulationAddresses.GBYTE, conf.accumulationDeviceAddress, (err, unit) => {
				if (err)
					return notifications.notifyAdmin('accumulation failed', err);
				console.log('accumulation done ' + unit);
				if (rows.length === constants.MAX_AUTHORS_PER_UNIT)
					sendMeBytes();
			});
		}
	);
}

function sendMeBtc() {
	if (!conf.accumulationAddresses.BTC)
		return console.log('BTC: no accumulation settings');
	console.log('will accumulate BTC');
	bitcoinApi.getBtcBalance(conf.btcMinConfirmations, (err, balance) => {
		if (err)
			return console.log("skipping BTC accumulation as getBtcBalance failed: " + err);
		if (balance < 0.5)
			return console.log("skipping BTC accumulation as balance is only " + balance + " BTC");
		let amount = balance - 0.01;
		bitcoinClient.sendToAddress(conf.accumulationAddresses.BTC, amount, (err, txid) => {
			console.log('BTC accumulation: amount ' + amount + ', txid ' + txid + ', err ' + err);
		});
	});
}

async function sendMeEther() {
	if (!conf.accumulationAddresses.ETH)
		return console.log('Ethereum no accumulation settings');
	let accounts = await web3.eth.getAccounts();
	let gasPrice = await web3.eth.getGasPrice();
	if (gasPrice === 0) gasPrice = 1;
	let fee = new BigNumber(21000).times(gasPrice);

	accounts.forEach(async (account) => {
		if (account !== conf.accumulationAddresses.ETH) {
			let balance = new BigNumber(await web3.eth.getBalance(account));
			console.error('balance', account, balance, typeof balance);
			if (balance.greaterThan(0) && balance.minus(fee).greaterThan(0)) {
				await web3.eth.personal.unlockAccount(account, conf.ethPassword);
				web3.eth.sendTransaction({
					from: account,
					to: conf.accumulationAddresses.ETH,
					value: balance.minus(fee),
					gas: 21000
				}, (err, txid) => {
					if (err) return console.error('not sent ether', account, err);
				});
			}
		}
	});
}

// for real-time only
function checkTokensBalance() {
	db.query(
		"SELECT SUM(amount) AS total_left FROM my_addresses CROSS JOIN outputs USING(address) WHERE is_spent=0 AND asset = ? AND EXISTS (SELECT 1 FROM inputs CROSS JOIN my_addresses USING(address) WHERE inputs.unit=outputs.unit AND inputs.asset=?)",
		[conf.issued_asset, conf.issued_asset],
		rows => {
			let total_left = rows[0].total_left;
			db.query("SELECT SUM(tokens) AS total_paid FROM transactions WHERE paid_out=1", rows => {
				let total_paid = rows[0].total_paid;
				if (total_left + total_paid !== conf.totalTokens)
					notifications.notifyAdmin('token balance mismatch', 'left ' + total_left + ' and paid ' + total_paid + " don't add up to " + conf.totalTokens);
			});
		}
	);
}

function getPlatformByCurrency(currency) {
	switch (currency) {
		case 'ETH':
			return 'ETHEREUM';
		case 'BTC':
			return 'BITCOIN';
		case 'GBYTE':
			return 'BYTEBALL';
		default:
			throw Error("unknown currency: " + currency);
	}
}

eventBus.on('in_transaction_stable', tx => {
	let device = require('ocore/device');
	const mutex = require('ocore/mutex');
	mutex.lock(['tx-' + tx.txid], unlock => {
		db.query("SELECT stable FROM transactions WHERE txid = ? AND receiving_address=?", [tx.txid, tx.receiving_address], async (rows) => {
			if (rows.length > 1)
				throw Error("non unique");
			if (rows.length && rows[0].stable) return;
			let orReplace = (tx.currency === 'ETH' || tx.currency === 'BTC') ? 'OR REPLACE' : '';

			if (conf.rulesOfDistributionOfTokens === 'one-time' && conf.exchangeRateDate === 'distribution') {
				db.query(
					"INSERT " + orReplace + " INTO transactions (txid, receiving_address, currency, byteball_address, device_address, currency_amount, tokens, stable) \n\
					VALUES(?, ?,?, ?,?,?,?, 1)",
					[tx.txid, tx.receiving_address, tx.currency, tx.obyte_address, tx.device_address, tx.currency_amount, null],
					() => {
						unlock();
						if (tx.device_address)
							device.sendMessageToDevice(tx.device_address, 'text', texts.paymentConfirmed());
					}
				);
			}
			else {
				let objTokensWithDiscount = await convertCurrencyToTokensWithDiscount(tx.obyte_address, tx.currency_amount, tx.currency); // might throw if called before the rates are ready
				let tokens = objTokensWithDiscount.tokens;
				if (tokens === 0) {
					unlock();
					if (tx.device_address)
						device.sendMessageToDevice(tx.device_address, 'text', "The amount is too small to issue even 1 token, payment ignored");
					return;
				}
				db.query(
					"INSERT " + orReplace + " INTO transactions (txid, receiving_address, currency, byteball_address, device_address, currency_amount, tokens, stable) \n\
					VALUES(?, ?,?, ?,?,?,?, 1)",
					[tx.txid, tx.receiving_address, tx.currency, tx.obyte_address, tx.device_address, tx.currency_amount, tokens],
					(res) => {
						unlock();
						tx.transaction_id = res.insertId;
						tx.tokens = tokens;
						if (conf.rulesOfDistributionOfTokens === 'real-time')
							sendTokensToUser(tx);
						else if (tx.device_address)
							device.sendMessageToDevice(tx.device_address, 'text', texts.paymentConfirmed());
					}
				);
			}
		});
		if (tx.currency === 'ETH' || tx.currency === 'BTC') {
			let platform = getPlatformByCurrency(tx.currency);
			checkUserAdress(tx.device_address, platform, bAddressKnown => {
				if (!bAddressKnown && conf.bRefundPossible)
					device.sendMessageToDevice(tx.device_address, 'text', texts.sendAddressForRefund(platform));
			});
		}
	});
});

eventBus.on('new_in_transaction', tx => {
	let device = require('ocore/device.js');
	if (tx.currency === 'ETH' || tx.currency === 'BTC') {
		let platform = getPlatformByCurrency(tx.currency);
		checkUserAdress(tx.device_address, platform, bAddressKnown => {
			db.query("SELECT txid FROM transactions WHERE txid = ? AND currency = ?", [tx.txid, tx.currency], (rows) => {
				if (rows.length) return;
				let blockNumber = 0;
				if (tx.currency === 'ETH' && tx.block_number) {
					blockNumber = tx.block_number;
				}
				db.query(
					"INSERT INTO transactions (txid, receiving_address, currency, byteball_address, device_address, currency_amount, tokens, block_number) \n\
					VALUES(?, ?,?, ?,?,?,?,?)",
					[tx.txid, tx.receiving_address, tx.currency, tx.obyte_address, tx.device_address, tx.currency_amount, null, blockNumber], () => {
						device.sendMessageToDevice(tx.device_address, 'text', "Received your payment of " + tx.currency_amount + " " + tx.currency + ", waiting for confirmation.");
						if (!bAddressKnown && conf.bRefundPossible)
							device.sendMessageToDevice(tx.device_address, 'text', texts.sendAddressForRefund(platform));
					});
			})
		});
	} else {
		device.sendMessageToDevice(tx.device_address, 'text', "Received your payment of " + tx.currency_amount + " " + tx.currency + ", waiting for confirmation.");
	}
});


eventBus.on('headless_wallet_ready', () => {
	let error = '';
	let arrTableNames = ['user_addresses', 'receiving_addresses', 'transactions'];
	db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN (?)", [arrTableNames], (rows) => {
		if (rows.length !== arrTableNames.length) error += texts.errorInitSql();

		if (!conf.admin_email || !conf.from_email) error += texts.errorEmail();

		if (error)
			throw new Error(error);

		if (conf.webPort) {
			setTimeout(() => {
				spawnWebServer();
			}, 3000);
		}

		setTimeout(sendMeBytes, 60 * 1000);
		setInterval(sendMeBytes, conf.accumulationInterval * 3600 * 1000);

		if (conf.ethEnabled) {
			ethereum_ins.startScan();
			setTimeout(sendMeEther, 60 * 1000);
			setInterval(sendMeEther, conf.ethAccumulationInterval * 3600 * 1000);
		}

		if (conf.btcEnabled) {
			setTimeout(sendMeBtc, 60 * 1000);
			setInterval(sendMeBtc, conf.btcAccumulationInterval * 3600 * 1000);
		}

		if (conf.rulesOfDistributionOfTokens === 'real-time') {
			setInterval(checkAndPayNotPaidTransactions, 3600 * 1000);
			setInterval(checkTokensBalance, 600 * 1000);
		}
	});
});

function spawnWebServer() {
	let prc = null;
	try {
		prc = spawn('node', ['./server/bin/www.js']);
	} catch (e) {
		console.error("Error trying to start web server");
		console.error(e);
		process.exit(1);
	}
	prc.stderr.on('data', (data) => {
		console.error(`web server err data:\n${data}`);
	});
	prc.on('close', (code) => {
		console.error('web server close: process exit code ' + code);
	});

	//do something when app is closing
	process.on('exit', handleExit);

	//catches ctrl+c event
	process.on('SIGINT', handleExit);

	// catches "kill pid" (for example: nodemon restart)
	process.on('SIGUSR1', handleExit);
	process.on('SIGUSR2', handleExit);

	function handleExit() {
		prc && prc.kill('SIGINT');
	}

}