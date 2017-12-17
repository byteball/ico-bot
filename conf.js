/*jslint node: true */
"use strict";
exports.port = null;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bLight = false;

exports.storage = 'sqlite';

// TOR is recommended.  If you don't run TOR, please comment the next two lines
exports.socksHost = '127.0.0.1';
exports.socksPort = 9050;

exports.hub = 'byteball.org/bb';
exports.deviceName = 'ICO Bot';
exports.permanent_pairing_secret = '0000';
exports.control_addresses = [''];
exports.payout_address = 'WHERE THE MONEY CAN BE SENT TO';

exports.bIgnoreUnpairRequests = true;
exports.bSingleAddress = false;
exports.bStaticChangeAddress = true;
exports.KEYS_FILENAME = 'keys.json';

//email
exports.useSmtp = false;
exports.admin_email = '';
exports.from_email = '';

// accumulation settings: the bot will periodically forward all collected funds to accumulationAddress (which is supposed to have better security, e.g. multisig)
exports.accumulationAddresses = {
	GBYTE: '',
	ETH: ''
};
exports.accumulationDeviceAddress = null;
exports.accumulationInterval = 1; // 1 hour
exports.minBalance = 100000; //bytes

// Ethereum
exports.ethEnabled = true;
exports.ethWSProvider = 'ws://localhost:8546';
exports.ethPassword = 'test';
exports.ethAccumulationInterval = 1; // 1 hour
exports.ethRefundAddress = '';
exports.minConfirmations = 6;

exports.tokenName = 'ICOTKN';
exports.issued_asset = null; // will be written to conf.json by scripts/issue_tokens.js
exports.startDate = '02.12.2017 13:00'; //dd.mm.yyyy
exports.endDate = '30.12.2017 13:00'; //dd.mm.yyyy
exports.totalTokens = 1000000; // number of smallest units
exports.asset_definition = {
	cap: exports.totalTokens, // totalTokens can be rewritten in conf.json
	is_private: false,
	is_transferrable: true,
	auto_destroy: false,
	fixed_denominations: false,
	issued_by_definer_only: true,
	cosigned_by_definer: false,
	spender_attested: false
};

exports.tokenDisplayDecimals = 2; // display token = 100 tokens

exports.rulesOfDistributionOfTokens = 'real-time'; // real-time OR one-time
//exports.rulesOfDistributionOfTokens = 'one-time'; // real-time OR one-time
exports.exchangeRateDate = 'distribution'; // if (rulesOfDistributionOfTokens == 'one-time') receipt-of-payment OR distribution
exports.assocPrices = {
	GBYTE: {
		price: 0.001,
		price_currency: 'USD'
	},
	ETH: {
		price: 0.001,
		price_currency: 'USD'
	}
};
