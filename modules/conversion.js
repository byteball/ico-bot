/*jslint node: true */
'use strict';
const async = require('async');
const request = require('request');
const conf = require('ocore/conf');
const notifications = require('./notifications');

let displayTokensMultiplier = Math.pow(10, conf.tokenDisplayDecimals);
let handlersOnReady = [];

var GBYTE_BTC_rate;
var ETH_BTC_rate;
var ETH_USD_rate;
var BTC_USD_rate;
var EUR_USD_rate = 1.134;
var GBP_USD_rate;
var USD_JPY_rate;
var USD_RUR_rate;

var bRatesReady = false;

function checkAllRatesUpdated() {
	if (bRatesReady) {
		return;
	}
	if (GBYTE_BTC_rate && BTC_USD_rate && EUR_USD_rate) {
		bRatesReady = true;
		console.log('rates are ready');
		handlersOnReady.forEach((handle) => { handle(); });
	}
}

function updateYahooRates() {
	let count_tries = 0;

	function onError(subject, body) {
		console.log(subject, body);
		count_tries++;
		if (count_tries < 5)
			setTimeout(tryUpdateYahooRates, 3000);
		else {
			notifications.notifyAdmin(subject, body);
			console.log("Can't get currency rates from yahoo, will retry later");
		}
	}

	function tryUpdateYahooRates() {
		console.log('updating yahoo');
		var apiUri = 'https://query.yahooapis.com/v1/public/yql?q=select+*+from+yahoo.finance.xchange+where+pair+=+%22EURUSD,GBPUSD,USDJPY,USDRUB%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&cb=';
		request(apiUri, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var jsonResult = JSON.parse(body);
				if (jsonResult.query && jsonResult.query.results && jsonResult.query.results.rate) {
					EUR_USD_rate = jsonResult.query.results.rate[0].Rate;
					GBP_USD_rate = jsonResult.query.results.rate[1].Rate;
					USD_JPY_rate = jsonResult.query.results.rate[2].Rate;
					USD_RUR_rate = jsonResult.query.results.rate[3].Rate;
					checkAllRatesUpdated();
				}
				else
					onError("bad response from yahoo", body);
			}
			else
				onError("getting yahoo data failed", error + ", status=" + (response ? response.statusCode : '?'));
		});
	}

	tryUpdateYahooRates();
}


function updateBittrexRates() {
	console.log('updating bittrex');
	const apiUri = 'https://bittrex.com/api/v1.1/public/getmarketsummaries';
	request(apiUri, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			let arrCoinInfos = JSON.parse(body).result;
			arrCoinInfos.forEach(coinInfo => {
				let price = coinInfo.Last; // number
				if (!price)
					return;
				if (coinInfo.MarketName === 'USDT-BTC')
					BTC_USD_rate = price;
				else if (coinInfo.MarketName === 'BTC-GBYTE')
					GBYTE_BTC_rate = price;
				else if (coinInfo.MarketName === 'BTC-ETH')
					ETH_BTC_rate = price;
				else if (coinInfo.MarketName === 'USDT-ETH')
					ETH_USD_rate = price;
			});
			checkAllRatesUpdated();
		}
		else {
			notifications.notifyAdmin("getting bittrex data failed", error + ", status=" + (response ? response.statusCode : '?'));
			console.log("Can't get currency rates from bittrex, will retry later");
		}
	});
}

function getCurrencyRate(currency1, currency2) {
	if (currency2 === 'USD' && currency1 === 'USDT') {
		return 1;
	}
	return getCurrencyRateOfGB(currency2) / getCurrencyRateOfGB(currency1);
}

function getCurrencyRateOfGB(currency) {
	if (currency === 'GBYTE')
		return 1;

	if (currency === 'ETH') {
		return GBYTE_BTC_rate /  ETH_BTC_rate;
	}

	if (currency === 'BTC') {
		if (!GBYTE_BTC_rate)
			throw Error("no GBYTE_BTC_rate");
		return GBYTE_BTC_rate;
	}
	if (currency === 'USD') {
		if (!GBYTE_BTC_rate || !BTC_USD_rate)
			throw Error("no GBYTE_BTC_rate || BTC_USD_rate");
		return GBYTE_BTC_rate * BTC_USD_rate;
	}
	if (currency === 'EUR') {
		if (!GBYTE_BTC_rate || !BTC_USD_rate || !EUR_USD_rate)
			throw Error("no GBYTE_BTC_rate || BTC_USD_rate || EUR_USD_rate");
		return GBYTE_BTC_rate * BTC_USD_rate / EUR_USD_rate;
	}
	if (currency === 'RUR') {
		if (!GBYTE_BTC_rate || !BTC_USD_rate || !USD_RUR_rate)
			throw Error("no GBYTE_BTC_rate || BTC_USD_rate || USD_RUR_rate");
		return GBYTE_BTC_rate * BTC_USD_rate * USD_RUR_rate;
	}
	throw Error('unknown currency: ' + currency);
}

function convertCurrencyToTokens(amountInCurrency, currency) {
	let objPrice = conf.assocPrices['all'] || conf.assocPrices[currency] || conf.assocPrices['default'];
	if (!objPrice)
		throw Error('no price for ' + currency);
	let amountInPriceCurrency = amountInCurrency * getCurrencyRate(currency, objPrice.price_currency);
	console.log('amountInPriceCurrency=' + amountInPriceCurrency);
	let amountInTokens = amountInPriceCurrency / objPrice.price;
	console.log('amountInTokens=' + amountInTokens);
	return Math.round(amountInTokens);
}


function enableRateUpdates() {
//	setInterval(updateYahooRates, 3600*1000);
	setInterval(updateBittrexRates, 600 * 1000);
}

//updateYahooRates();
updateBittrexRates();

exports.convertCurrencyToTokens = convertCurrencyToTokens;
exports.enableRateUpdates = enableRateUpdates;
exports.displayTokensMultiplier = displayTokensMultiplier;
exports.getCurrencyRate = getCurrencyRate;
exports.onReady = (func) => {
	if (typeof func !== 'function') throw new Error('conversion onReady must be a function');
	handlersOnReady.push(func);
};