/*jslint node: true */
'use strict';
const desktopApp = require('ocore/desktop_app.js');
const conf = require('ocore/conf.js');

const displayTokensMultiplier = Math.pow(10, conf.tokenDisplayDecimals);

function getPrices(){
	if (conf.assocPrices['all']){
		let arrCurrencies = ['GBYTE'];
		if (conf.ethEnabled)
			arrCurrencies.push('ETH');
		if (conf.btcEnabled)
			arrCurrencies.push('BTC');
		let objPrice = conf.assocPrices['all'];
		return (objPrice.price * displayTokensMultiplier).toLocaleString([], {maximumFractionDigits: 9})+' '+objPrice.price_currency+' when paid in '+arrCurrencies.join(', ');
	}
	// no 'all' price
	var arrPrices = [];
	for (var currency in conf.assocPrices){
		let objPrice = conf.assocPrices[currency];
		arrPrices.push((objPrice.price * displayTokensMultiplier).toLocaleString([], {maximumFractionDigits: 9})+' '+objPrice.price_currency+' when paid in '+(currency === 'default' ? 'any other supported currency' : currency));
	}
	return arrPrices.join("\n");
}

function getDiscountLevels(){
	let arrAttestorSections = [];
	for (let attestor_address in conf.discounts){
		let objAttestor = conf.discounts[attestor_address];
		let field;
		for (let key in objAttestor.discount_levels[0])
			if (key !== 'discount')
				field = key;
		let arrLines = objAttestor.discount_levels.map(objLevel => {
			return field+" "+objLevel[field]+" and more: "+objLevel.discount+"% discount";
		});
		arrAttestorSections.push(objAttestor.domain+" attestations:\n"+arrLines.join("\n"));
	}
	return arrAttestorSections.join("\n\n");
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

exports.greeting = () => {
	let response = "Here you can buy "+conf.tokenName+" tokens.  The price of 1 "+conf.tokenName+" is:\n"+getPrices()+".";
	if (conf.discounts)
		response += "\n\nDiscounts apply if you use a publicly attested address to buy the tokens and have a high enough rank:\n\n"+getDiscountLevels();
	return response;
};

exports.howmany = () => {
	let text = 'How much and what currency are you willing to invest?';
	text += "\n" + '* [10 GB](suggest-command:10 GBYTE)';
	text += conf.ethEnabled ? "\n" + '* [2.5 ETH](suggest-command:2.5 ETH)' : '';
	text += conf.btcEnabled ? "\n" + '* [0.5 BTC](suggest-command:0.5 BTC)' : '';
	return text;
};

exports.insertMyAddress = () => {
	return conf.bRequireRealName
		? 'To participate in this ICO, your real name has to be attested and we require to provide your private profile, which includes your first name, last name, country, date of birth, and ID number.  If you are not attested yet, find "Real name attestation bot" in the Bot Store and have your address attested.  If you are already attested, click this link to reveal your private profile to us: [profile request](profile-request:'+conf.arrRequiredPersonalData.join(',')+').  We\'ll keep your personal data private and will not share it with anybody except as required by law.'
		: 'Please send me your address where you wish to receive the tokens (click ... and Insert my address).';
};

exports.discount = (objDiscount) => {
	return "As a "+objDiscount.domain+" user with "+objDiscount.field+" over "+objDiscount.threshold_value+" you are eligible to discount of "+objDiscount.discount+"% after successful payment.";
};

exports.includesDiscount = (objDiscount) => {
	return "The price includes a "+objDiscount.discount+"% discount which you receive as a "+objDiscount.domain+" user with "+objDiscount.field+" over "+objDiscount.threshold_value+".";
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

exports.errorEmail = () => {
	return `please specify admin_email and from_email in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};
