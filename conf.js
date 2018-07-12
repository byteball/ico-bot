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
exports.ethRefundDistributionAddress = '';
exports.ethMinConfirmations = 20;

// Bitcoin
exports.btcEnabled = true;
exports.btcRpcUser = 'bitcoin';
exports.btcRpcPassword = 'local321';
exports.btcAccumulationInterval = 1; // 1 hour
exports.btcRefundDistributionAddress = '';
exports.btcMinConfirmations = 2;

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

// the prices are for the smallest indivisible unit (there are totalTokens of them).
// the key is the payment currency, prices can be different depending on currency.
// special values for the payment currency:
//   all: to set the same price for all payment currencies (recommended), all other keys are ignored in this case
//   default: to set the price for all other supported currencies
// all prices are in 'price_currency', which might be different from the payment currency

// same price for all currences:
exports.assocPrices = {
	all: {
		price: 0.001,
		price_currency: 'USD'
	}
};
/*
// different prices depending on which currency is invested
exports.assocPrices = {
	GBYTE: {
		price: 0.001,
		price_currency: 'USD'
	},
	ETH: {
		price: 0.0015,
		price_currency: 'USD'
	},
	// optional: any other currency not listed above
	default: {
		price: 0.001,
		price_currency: 'USD'
	}
};
*/


// discounts for attested users, uncomment and edit to apply
/*
exports.discounts = {
	JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725: {
		domain: 'Steem',
		discount_levels: [
			{reputation: 50, discount: 10},
			{reputation: 60, discount: 20},
			{reputation: 70, discount: 30},
		]
	},
};
*/

exports.bRefundPossible = true;

exports.bRequireRealName = false;
exports.arrRealNameAttestors = ['I2ADHGP4HL6J37NQAD73J7E5SKFIXJOT'];
exports.arrRequiredPersonalData = ['first_name', 'last_name', 'country', 'dob', 'id_number', 'id_type'];

exports.bRequireNonUs = false;
exports.arrNonUsAttestors = ['C4O37BFHR46UP6JJ4A5PA5RIZH5IFPZF'];

exports.bRequireAccredited = false;
exports.arrAccreditedAttestors = ['BVVJ2K7ENPZZ3VYZFWQWK7ISPCATFIW3'];

// web server
exports.webPort = 8080;
// usually you don't need to enable SSL in node.js as nginx takes care of it
exports.bUseSSL = false; // if set to true, add key.pem and cert.pem files in the app data directory
exports.bCorsEnabled = false;


// admin

// these device addresses are allowed to edit prices
exports.arrAdminAddresses = null;
//exports.arrAdminAddresses = ["07SSQSWYYRSJZKQMBQW6FKGLSLLT73A7I", "0JSGWWSE6IGEMMTHGYHQV7VCAQU43IIWA"];
