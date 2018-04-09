const $elTableHead = $('#thead');
const $elTableBody = $('#tbody');
const $elTablePagination = $('#tpagination');

let data = {
	maxDecCurrencyAmount: 0,
	maxDecTokens: 0,
};

let table = new Table({
	data: {
		url: '/api/transactions',
		handlePostLoadData: () => {
			data.maxDecCurrencyAmount = 0;
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
				let strTokens = '' + row.tokens;
				if (strTokens.indexOf('.') >= 0) {
					const lengthDecTokens = strTokens.split('.')[1].length;
					if (lengthDecTokens > data.maxDecTokens) {
						data.maxDecTokens = lengthDecTokens;
					}
				}
			}
		}
	},
	params: {
		// 'transaction_id': {
		// 	title: 'id'
		// },
		'creation_date': {
			head: {
				title: 'created',
				sort: {
					used: true,
				},
			}
		},
		'txid': {
			body: {
				format: (val, row) => {
					switch (row.currency) {
						case 'GBYTE':
							return `<a href="https://explorer.byteball.org/#${val}" target="_blank">${val}</a>`;
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
		'receiving_address': {
			head: {
				title: 'receiving address',
			}
		},
		'byteball_address': {
			head: {
				title: 'bb address',
			}
		},
		// 'device_address': {
		// 	title: 'device address'
		// },
		'currency': {},
		'currency_amount': {
			head: {
				title: 'currency amount',
				sort: {
					used: false,
				},
			},
			body: {
				class: 'dec-align',
				format: (val) => {
					let strVal = '' + val;
					if (strVal.indexOf('.') >= 0) {
						let strDec = strVal.split('.')[1];
						strVal += ' '.repeat(data.maxDecCurrencyAmount - strDec.length);
					} else if (data.maxDecCurrencyAmount) {
						strVal += (' '.repeat(data.maxDecCurrencyAmount + 1));
					}
					return strVal;
				}
			}
		},
		'tokens': {
			body: {
				class: 'dec-align',
				format: (val) => {
					let strVal = '' + val;
					if (strVal.indexOf('.') >= 0) {
						let strDec = strVal.split('.')[1];
						strVal += ' '.repeat(data.maxDecTokens - strDec.length);
					} else if (data.maxDecTokens) {
						strVal += (' '.repeat(data.maxDecTokens + 1));
					}
					return strVal;
				}
			}
		},
		// 'refunded': {},
		// 'paid_out': {},
		// 'paid_date': {},
		// 'refund_date': {},
		// 'payout_unit': {},
		// 'refund_txid': {},
		'stable': {
			body: {
				format: (val) => {
					return val === 1 ? 'true' : 'false';
				}
			}
		},
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