/*jslint node: true */
'use strict';
const desktopApp = require('byteballcore/desktop_app.js');
const conf = require('byteballcore/conf.js');

const displayTokensMultiplier = Math.pow(10, conf.tokenDisplayDecimals);

function getPrices(){
	var arrPrices = [];
	for (var currency in conf.assocPrices){
		let objPrice = conf.assocPrices[currency];
		arrPrices.push((objPrice.price * displayTokensMultiplier).toLocaleString([], {maximumFractionDigits: 9})+' '+objPrice.price_currency+' when paid in '+currency);
	}
	return arrPrices.join("\n");
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

exports.greeting = () => {
	return "Here you can buy "+conf.tokenName+" tokens.  The price of 1 "+conf.tokenName+" is:\n"+getPrices();
};

exports.howmany = () => {
	return 'How much and what currency are you willing to invest?\nFor example: 1.5GB, or 2.5ETH, or 0.5BTC';
};

exports.insertMyAddress = () => {
	return conf.bRequireRealName
		? 'To participate in this ICO, your real name has to be attested and we require to provide your private profile, which includes your first name, last name, country, date of birth, and ID number.  If you are not attested yet, find "Real name attestation bot" in the Bot Store and have your address attested.  If you are already attested, click this link to reveal your private profile to us: [profile request](profile-request:'+conf.arrRequiredPersonalData.join(',')+').  We\'ll keep your personal data private and will not share it with anybody except as required by law.'
		: 'Please send me your address where you wish to receive the tokens (click ... and Insert my address).';
};

exports.paymentConfirmed = () => {
	return 'The payment is confirmed, you will receive your tokens at the time of distribution.';
};

exports.sendAddressForRefund = (platform) => {
	return "Please send me your "+capitalizeFirstLetter(platform)+" address in case we need to make a refund.";
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
