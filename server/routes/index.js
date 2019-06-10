const router = require('express').Router();
const moment = require('moment');
const conf = require('ocore/conf');
const db = require('ocore/db');
const log = require('./../libs/logger')(module);
const { query: checkQuery, validationResult, oneOf } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');
const conversion = require('./../../modules/conversion.js');

const arrCurrencies = ['GBYTE', 'BTC', 'ETH', 'USDT'];

conf.database.bReadOnly = true;

router.get('/', (req, res) => {
	res.status(200).json({
		version: process.env.npm_package_version,
		current_time: new Date()
	});
});

router.get('/init', (req, res) => {
	res.status(200).json({
		tokenName: conf.tokenName
	});
});

const checkCurrencyData = checkQuery('filter_currency').optional().isIn(['all', 'GBYTE', 'BTC', 'ETH', 'USDT']);

router.get('/transactions', [
	checkQuery('page').optional().isInt({min:1}),
	checkQuery('limit').optional().isInt({min:1, max:100}),
	checkQuery('sort').optional().isIn(['currency_amount', 'creation_date']),
	checkQuery('filter_bb_address').optional().trim(),
	checkQuery('filter_receiving_address').optional().trim(),
	checkQuery('filter_txid').optional().trim(),
	checkQuery('filter_stable').optional().trim(),
	checkCurrencyData,
], (req, res) => {
	const objErrors = validationResult(req);
	if (!objErrors.isEmpty()) {
		return res.status(422).json({ errors: objErrors.mapped() });
	}

	const data = matchedData(req);
	// set default data values
	if (!data.page) data.page = 1;
	if (!data.limit) data.limit = 10;
	// prepare income data values
	data.page = Number(data.page);
	data.limit = Number(data.limit);

	let numOffset = (data.page - 1) * data.limit;
	let strOrderByField = data.sort === 'currency_amount' ? 'currency_amount' : 'creation_date';

	let arrParams = [];

	let strSqlWhere = '1=1';
	if (data.filter_bb_address) {
		strSqlWhere += ' AND byteball_address = ?';
		arrParams.push(data.filter_bb_address);
	}
	if (data.filter_receiving_address) {
		strSqlWhere += ' AND receiving_address = ?';
		arrParams.push(data.filter_receiving_address);
	}
	if (data.filter_txid) {
		strSqlWhere += ' AND txid = ?';
		arrParams.push(data.filter_txid);
	}
	if (data.filter_currency && data.filter_currency !== 'all') {
		strSqlWhere += ' AND currency = ?';
		arrParams.push(data.filter_currency);
	}
	if (data.hasOwnProperty('filter_stable') && data.filter_stable !== 'all') {
		strSqlWhere += ' AND stable = ?';
		arrParams.push(['true','1',1].includes(data.filter_stable) ? 1 : 0);
	}

	const arrParamsTotal = arrParams.slice();
	const strSqlTotal = `SELECT
		COUNT(transaction_id) AS count
	FROM transactions
	WHERE ${strSqlWhere}`;

	let strSqlCaseCurrency = '';
	let strSqlCaseUsdCurrency = '';
	for (let i = 0; i < arrCurrencies.length; i++) {
		let strCurrency = arrCurrencies[i];
		let currencyRate = conversion.getCurrencyRate(strCurrency, 'USD');
		strSqlCaseCurrency += `WHEN '${strCurrency}' THEN ROUND(currency_amount, ${getNumberRoundDisplayDecimalsOfCurrency(strCurrency)})\n`;
		strSqlCaseUsdCurrency += `WHEN '${strCurrency}' THEN ROUND(currency_amount * ${currencyRate}, 2)\n`;
	}

	const strSql = `SELECT
		txid,
		receiving_address,
		byteball_address,
		currency,
		CASE currency 
			${strSqlCaseCurrency}
			ELSE currency_amount
			END AS currency_amount,
		CASE currency
			${strSqlCaseUsdCurrency}
			ELSE currency_amount
			END AS usd_amount,
		ROUND(tokens * ${Math.pow(10, -conf.tokenDisplayDecimals)}, ${conf.tokenDisplayDecimals}) AS tokens,
		stable,
		creation_date
	FROM transactions
	WHERE ${strSqlWhere}
	ORDER BY ${strOrderByField} DESC
	LIMIT ? OFFSET ?`;
	arrParams.push(data.limit, numOffset);

	log.verbose(strSql);
	log.verbose(arrParams);

	db.query(strSqlTotal, arrParamsTotal, (rows) => {
		log.verbose('row %j', rows);
		let row = rows[0];

		db.query(strSql, arrParams, (rows) => {
			res.status(200).json({rows, total: row.count});
		});
	});
});

router.get('/statistic', [
	checkCurrencyData,
	checkQuery(['filter_date_from', 'filter_date_to']).optional().isISO8601(),
], (req, res) => {
	const objErrors = validationResult(req);
	if (!objErrors.isEmpty()) {
		return res.status(422).json({ errors: objErrors.mapped() });
	}

	const data = matchedData(req);

	let arrParams = [];

	let strSqlWhere = 'stable = 1';
	let nRoundDisplayDecimals = conf.tokenDisplayDecimals;
	if (data.filter_currency && data.filter_currency !== 'all') {
		strSqlWhere += ' AND currency = ?';
		arrParams.push(data.filter_currency);
		nRoundDisplayDecimals = getNumberRoundDisplayDecimalsOfCurrency(data.filter_currency);
	}
	if (data.filter_date_from && data.filter_date_to) {
		strSqlWhere += ' AND paid_date BETWEEN ? AND ?';
		arrParams.push(
			moment(data.filter_date_from).format('YYYY-MM-DD 00:00:01'), 
			moment(data.filter_date_to).format('YYYY-MM-DD 23:59:59')
		);
	}

	const filter_currency = data.filter_currency;
	const isFilterCurrency = filter_currency && filter_currency!=='all';
	
	let strSql;

	if (isFilterCurrency) {
		strSql = `SELECT
			date(paid_date) AS date,
			COUNT(transaction_id) AS count,
			ROUND(SUM(currency_amount), ${nRoundDisplayDecimals}) AS sum,
			ROUND(SUM(currency_amount) * ${conversion.getCurrencyRate(filter_currency, 'USD')}, 2) AS usd_sum
		FROM transactions AS transactions_main
		WHERE ${strSqlWhere}
		GROUP BY date
		ORDER BY date ASC`;
	} else {
		let strSqlCase = '';
		for (let i = 0; i < arrCurrencies.length; i++) {
			let strCurrency = arrCurrencies[i];
			let currencyRate = conversion.getCurrencyRate(strCurrency, 'USD');
			strSqlCase += `WHEN '${strCurrency}' THEN ${currencyRate}\n`;
		}
		strSql = `SELECT
			date(paid_date) AS date,
			COUNT(transaction_id) AS count,
			ROUND(
				SUM(currency_amount * (
					CASE currency 
						${strSqlCase}
						ELSE 1
					END
				))
			, 2) AS usd_sum
		FROM transactions AS transactions_main
		WHERE ${strSqlWhere}
		GROUP BY date
		ORDER BY date ASC`;
	}

	log.verbose(strSql);
	log.verbose(arrParams);

	db.query(strSql, arrParams, (rows) => {
		res.status(200).json({rows});
	});
});

router.get('/common', (req, res) => {

	let arrParams = [];

	let strSql = `SELECT
		currency,
		SUM(currency_amount) AS currency_amount
	FROM transactions
	GROUP BY currency`;

	db.query(strSql, arrParams, (rows) => {
		let totalSum = 0.0;
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			totalSum += (row.currency_amount * conversion.getCurrencyRate(row.currency, 'USD'));
		}

		strSql = `SELECT
			COUNT(transaction_id) AS count_transactions,
			(SELECT COUNT(t.device_address) AS count FROM (SELECT device_address FROM transactions GROUP BY device_address) AS t) AS users_all,
			(SELECT COUNT(t.device_address) AS count FROM (SELECT device_address FROM transactions WHERE paid_out = 1 GROUP BY device_address) AS t) AS users_paid
		FROM transactions`;

		db.query(strSql, arrParams, (rows) => {
			let row = rows[0];
			row.total_sum = parseFloat(totalSum.toFixed(2));
			res.status(200).json(row);
		});
	});
});

module.exports = router;

function getNumberRoundDisplayDecimalsOfCurrency(currency) {
	switch (currency) {
		case 'GBYTE':
			return 9;
		case 'BTC':
			return 8;
		case 'ETH':
			return 8;
		case 'USDT':
			return 2;
		default: return 8;
	}
}