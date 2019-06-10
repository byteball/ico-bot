/*jslint node: true */
'use strict';
const fs = require('fs');
const headlessWallet = require('headless-obyte');
const conf = require('ocore/conf');
const eventBus = require('ocore/event_bus.js');
const db = require('ocore/db');
const desktopApp = require('ocore/desktop_app.js');

headlessWallet.setupChatEventHandlers();

const MIN_BALANCE = 3000;
let myAddress = null;
conf.asset_definition.cap = conf.totalTokens;

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
	db.query(
		"SELECT address, SUM(amount) AS amount FROM my_addresses CROSS JOIN outputs USING(address) JOIN units USING(unit) \n\
		WHERE is_spent=0 AND asset IS NULL AND is_stable=1 GROUP BY address",
		rows => {
			for (let i = 0; i < rows.length; i++) {
				if (rows[i].amount >= MIN_BALANCE) {
					myAddress = rows[i].address;
					break;
				}
			}
			if (myAddress === null){
				return db.query("SELECT address FROM my_addresses LIMIT 1", rows => {
					console.error("==== Please refill your balance to pay for the fees, your address is "+rows[0].address+", minimum balance is "+MIN_BALANCE+" bytes.");
				});
			}

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
	);
}

function defineAsset() {
	const composer = require('ocore/composer.js');
	const network = require('ocore/network');
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
	composer.composeAssetDefinitionJoint(myAddress, conf.asset_definition, headlessWallet.signer, callbacks);
}

function issueAsset(){
	const divisibleAsset = require('ocore/divisible_asset.js');
	const network = require('ocore/network');

	divisibleAsset.composeAndSaveDivisibleAssetPaymentJoint({
		asset: conf.issued_asset,
		paying_addresses: [myAddress],
		fee_paying_addresses: [myAddress],
		change_address: myAddress,
		to_address: myAddress,
		amount: conf.totalTokens,
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
