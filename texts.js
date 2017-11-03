/*jslint node: true */
'use strict';
const desktopApp = require('byteballcore/desktop_app.js');
const conf = require('byteballcore/conf.js');

const displayTokensMultiplier = Math.pow(10, conf.tokenDisplayDecimals);

function getPrices(){
	var arrPrices = [];
	for (var currency in conf.assocPrices){
		let objPrice = conf.assocPrices[currency];
		arrPrices.push((objPrice.price * displayTokensMultiplier)+' '+objPrice.price_currency+' when paid in '+currency);
	}
	return arrPrices.join("\n");
}

exports.greeting = () => {
	return "Here you can buy "+conf.tokenName+" tokens.  The prices are:\n"+getPrices();
};

exports.howmany = () => {
	return 'How many GB are you willing to invest?\nFor example: 1.5GB';
};

exports.insertMyAddress = () => {
	return 'Please send me your address where you wish to receive the tokens (click ... and Insert my address).';
};

exports.paymentConfirmed = () => {
	return 'The payment is confirmed, you will receive your tokens at the time of distribution.';
};

//errors
exports.errorInitSql = () => {
	return 'please import ico.sql file\n';
};

exports.errorSmtp = () => {
	return `please specify smtpUser, smtpPassword and smtpHost in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};

exports.errorEmail = () => {
	return `please specify admin_email and from_email in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};
