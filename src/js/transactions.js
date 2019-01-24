const $elTableHead = $('#thead');
const $elTableBody = $('#tbody');
const $elTablePagination = $('#tpagination');

let data = {
	maxDecCurrencyAmount: 0,
	maxDecUsdCurrencyAmount: 0,
	maxDecTokens: 0,
};

let table = new Table({
	data: {
		url: '/api/transactions',
		handlePostLoadData: () => {
			data.maxDecCurrencyAmount = 0;
			data.maxDecUsdCurrencyAmount = 0;
			data.maxDecTokens = 0;
			const rows = table.data.rows;
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];

				let strCurrencyAmount = '' + row.currency_amount;
				if (strCurrencyAmount.indexOf('.') >= 0) {
					const lengthDecCurrencyAmount = strCurrencyAmount.split('.')[1].length;
					if (lengthDecCurrencyAmount > data.maxDecCurrencyAmount) {
						data.maxDecCurrencyAmount = lengthDecCurrencyAmount;
					}
				}

				let strUsdCurrencyAmount = '' + row.usd_amount;
				if (strUsdCurrencyAmount.indexOf('.') >= 0) {
					const lengthDecUsdCurrencyAmount = strUsdCurrencyAmount.split('.')[1].length;
					if (lengthDecUsdCurrencyAmount > data.maxDecUsdCurrencyAmount) {
						data.maxDecUsdCurrencyAmount = lengthDecUsdCurrencyAmount;
					}
				}

				let strTokens = '' + row.tokens;
				if (strTokens.indexOf('.') >= 0) {
					const lengthDecTokens = strTokens.split('.')[1].length;
					if (lengthDecTokens > data.maxDecTokens) {
						data.maxDecTokens = lengthDecTokens;
					}
				}

				console.log('data', data);
			}
		}
	},
	params: {
		'creation_date': {
			head: {
				title: 'created',
				sort: {
					used: true,
				},
			}
		},
		'currency_amount': {
			head: {
				title: 'currency amount',
				sort: {
					used: false,
				},
			},
			body: {
				class: 'dec-align',
				format: Table.getFormatFunctionForDecField(data, 'maxDecCurrencyAmount'),
			}
		},
		'currency': {},
		usd_amount: {
			head: {
				title: '$ amount'
			},
			body: {
				class: 'dec-align',
				format: Table.getFormatFunctionForDecField(data, 'maxDecUsdCurrencyAmount'),
			}
		},
		'tokens': {
			body: {
				class: 'dec-align',
				format: Table.getFormatFunctionForDecField(data, 'maxDecTokens'),
			}
		},
		'byteball_address': {
			head: {
				title: 'investor bb address',
			}
		},
		'txid': {
			body: {
				format: (val, row) => {
					switch (row.currency) {
						case 'GBYTE':
							return `<a href="https://explorer.obyte.org/#${val}" target="_blank">${val}</a>`;
						case 'BTC':
							return `<a href="https://blockchain.info/tx/${val}" target="_blank">${val}</a>`;
						case 'ETH':
							return `<a href="https://etherscan.io/tx/${val}" target="_blank">${val}</a>`;
						case 'USDT':
							return `<a href="https://omniexplorer.info/search/${val}" target="_blank">${val}</a>`;
						default: return val;
					}
				}
			}
		},
		'stable': {
			body: {
				format: (val) => {
					return val === 1 ? 'true' : 'false';
				}
			}
		},
		'receiving_address': {
			head: {
				title: 'receiving address',
			}
		},
		// 'refunded': {},
		// 'paid_out': {},
		// 'paid_date': {},
		// 'refund_date': {},
		// 'payout_unit': {},
		// 'refund_txid': {},
		// 'block_number': {},
	}
}, $elTableHead, $elTableBody, $elTablePagination);
window.table = table;

window.onpopstate = (event) => {
	if (table.checkUrlParamsWereChanged()) {
		table.loadData();
	}
};

table.checkUrlParamsWereChanged();
table.createHeader();
table.createPagination();

$(() => {
	table.loadData();
});