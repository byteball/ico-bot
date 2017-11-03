/*jslint node: true */
'use strict';
const fs = require('fs');
const headlessWallet = require('headless-byteball');
const conf = require('byteballcore/conf');
const eventBus = require('byteballcore/event_bus.js');
const db = require('byteballcore/db');
const desktopApp = require('byteballcore/desktop_app.js');

let myAddress = null;

function onError(err) {
	throw Error(err);
}

function updateAssetInConf(issued_asset){
	var appDataDir = desktopApp.getAppDataDir();
	var userConfFile = appDataDir + '/conf.json';
	var json = require(userConfFile);
	json.issued_asset = issued_asset;
	fs.writeFile(userConfFile, JSON.stringify(json, null, '\t'), 'utf8', function(err){
		if (err)
			throw Error('failed to write conf.json: '+err);
	});
}

function checkAndIssue(){
	if (!conf.issued_asset)
		return defineAsset();
	db.query("SELECT is_stable FROM assets JOIN units USING(unit) WHERE unit=?", [conf.issued_asset], function(rows){
		if (rows.length === 0)
			throw Error("asset "+conf.issued_asset+" not found");
		if (rows[0].is_stable === 0){
			console.error('==== already defined but the definition is not stable yet, will wait for stability and issue');
			return waitForStabilityAndIssue();
		}
		db.query("SELECT 1 FROM outputs WHERE asset=? LIMIT 1", [conf.issued_asset], function(rows){
			if (rows.length > 0)
				return console.error('==== already issued');
			issueAsset();
		});
	});
}

function defineAsset() {
	db.query(
		"SELECT address, SUM(amount) AS amount FROM my_addresses CROSS JOIN outputs USING(address) JOIN units USING(unit) \n\
		WHERE is_spent=0 AND asset IS NULL AND is_stable=1 GROUP BY address", 
		rows => {
			for (let i = 0; i < rows.length; i++) {
				if (rows[i].amount >= 2000) {
					myAddress = rows[i].address;
					break;
				}
			}
			if (myAddress === null){
				return db.query("SELECT address FROM my_addresses LIMIT 1", rows => {
					console.error("==== Please refill your balance to pay for the fees, your address is "+rows[0].address+", minimum balance is 3000 bytes.");
				});
			}

			const composer = require('byteballcore/composer.js');
			const network = require('byteballcore/network');
			let callbacks = composer.getSavingCallbacks({
				ifNotEnoughFunds: onError,
				ifError: onError,
				ifOk: objJoint => {
					network.broadcastJoint(objJoint);
					conf.issued_asset = objJoint.unit.unit;
					updateAssetInConf(conf.issued_asset);
					console.error("==== Defined asset, now waiting for stability of asset definition unit " + conf.issued_asset);
					waitForStabilityAndIssue();
				}
			});
			composer.composeAssetDefinitionJoint(myAddress, conf.getAssetDefinition(), headlessWallet.signer, callbacks);
		}
	);
}

function issueAsset(){
	const divisibleAsset = require('byteballcore/divisible_asset.js');
	const network = require('byteballcore/network');
	
	// when issuing, we also split the asset into 100 outputs for parallel payouts
	const COUNT_CHUNKS = 100;
	let chunk_amount = Math.round(conf.totalTokens/COUNT_CHUNKS);
	let arrOutputs = [];
	for (var i=1; i<COUNT_CHUNKS; i++) // 99 iterations
		arrOutputs.push({amount: chunk_amount, address: myAddress});
	
	divisibleAsset.composeAndSaveDivisibleAssetPaymentJoint({
		asset: conf.issued_asset,
		paying_addresses: [myAddress],
		fee_paying_addresses: [myAddress],
		change_address: myAddress,
	//	to_address: myAddress,
	//	amount: conf.totalTokens,
		asset_outputs: arrOutputs,
		signer: headlessWallet.signer,
		callbacks: {
			ifError: onError,
			ifNotEnoughFunds: onError,
			ifOk: (objJoint) => {
				network.broadcastJoint(objJoint);
				console.error('==== Token issued');
			}
		}
	});
}

function waitForStabilityAndIssue(){
	eventBus.once('my_stable-'+conf.issued_asset, issueAsset);
}

eventBus.on('headless_wallet_ready', checkAndIssue);
