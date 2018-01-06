/*jslint node: true */
'use strict';
var bitcoinClient = require('./bitcoin_client.js');

function getBtcBalance(count_confirmations, handleBalance, counter){
	bitcoinClient.getBalance('*', count_confirmations, function(err, btc_balance, resHeaders) {
		if (err){
			// retry up to 3 times
			if (counter >= 3)
				return handleBalance("getBalance "+count_confirmations+" failed: "+err);
			counter = counter || 0;
			console.log('getBalance attempt #'+counter+' failed: '+err);
			setTimeout( () => {
				getBtcBalance(count_confirmations, handleBalance, counter + 1);
			}, 60*1000);
			return;
		}
		handleBalance(null, btc_balance);
	});
}

// amount in BTC
function sendBtc(amount, address, onDone){
	client.sendToAddress(address, amount, function(err, txid, resHeaders) {
		console.log('bitcoin sendToAddress '+address+', amount '+amount+', txid '+txid+', err '+err);
		if (err)
			return onDone(err);
		onDone(null, txid);
	});
}


exports.getBtcBalance = getBtcBalance;
exports.sendBtc = sendBtc;
