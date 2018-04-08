const DATE_FORMAT = 'YYYY-MM-DD';
const $elFilterCurrency = $('#filter_currency');
const $elDateFrom = $('#filter_date_from');
const $elDateTo = $('#filter_date_to');

const $elTableHead = $('#thead');
const $elTableBody = $('#tbody');
// const $elTablePagination = $('#tpagination');

let table = new Table({
	data: {
		url: '/api/statistic',
		sort: 'date',
		filterFormat: {
			filter_date_from: (val) => val && val.format(DATE_FORMAT),
			filter_date_to: (val) => val && val.format(DATE_FORMAT)
		},
		jsonUrlFilterFormat: {
			filter_date_from: {
				toStr: (val) => val && val.format(DATE_FORMAT),
				toVal: (val) => {
					try {
						return moment(val);
					} catch (e) {
						return moment().subtract(1, 'years')
					}
				},
				update: (val) => {

				}
			},
			filter_date_to: {
				toStr: (val) => val && val.format(DATE_FORMAT),
				toVal: (val) => {
					try {
						return moment(val);
					} catch (e) {
						let now = new Date();
						now.setHours(0,0,0,0);
						return moment(now);
					}
				},
				update: (val) => {

				}
			}
		}
	},
	params: {
		'date': {
			head: {
				sort: {
					used: true,
				},
			}
		},
		'count': {},
		'sum': {
			head: {
				isAvailable: () => {
					return $elFilterCurrency.val() !== 'all';
				}
			},
			body: {
				isAvailable: () => {
					return $elFilterCurrency.val() !== 'all';
				}
			}
		},
	}
}, $elTableHead, $elTableBody);
window.table = table;

window.onpopstate = (event) => {
	if (table.checkUrlParamsWereChanged()) {
		table.loadData();
	}
};

table.checkUrlParamsWereChanged();
initRangeDatePicker();
table.createHeader();
table.createPagination();

$(() => {
	table.loadData();
});

function initRangeDatePicker() {
	let defaultDatepickerOptions = {
		todayBtn: true,
		autoclose: true,
	};

	// console.log('table.data.filter', table.data);
	if (!table.data.filter.filter_date_from) {
		table.data.filter.filter_date_from = moment(table.data.filter.filter_date_to ? table.data.filter.filter_date_to : undefined).subtract(1, 'years');
	}
	if (!table.data.filter.filter_date_to) {
		let now = new Date();
		now.setHours(0,0,0,0);
		table.data.filter.filter_date_to = moment(now);
	}

	$elDateFrom.datepicker(Object.assign({
		endDate: table.data.filter.filter_date_to.toDate(),
	}, defaultDatepickerOptions)).on('changeDate', (ev) => {
		// console.log('change date from', ev);
		table.data.filter.filter_date_from = moment(ev.date.valueOf());
		$elDateTo.datepicker('setStartDate', table.data.filter.filter_date_from.toDate());
		table.loadData();
	});
	$elDateFrom.datepicker('update', table.data.filter.filter_date_from.toDate());

	$elDateTo.datepicker(Object.assign({
		startDate: table.data.filter.filter_date_from.toDate(),
		endDate: table.data.filter.filter_date_to.toDate(),
	}, defaultDatepickerOptions)).on('changeDate', (ev) => {
		// console.log('change date to', ev);
		table.data.filter.filter_date_to = moment(ev.date.valueOf());
		$elDateFrom.datepicker('setEndDate', table.data.filter.filter_date_to.toDate());
		table.loadData();
	});
	$elDateTo.datepicker('update', table.data.filter.filter_date_to.toDate());
}