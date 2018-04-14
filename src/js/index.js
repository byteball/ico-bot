const _MS_PER_DAY = 1000 * 60 * 60 * 24;
const timerLoadChartData = 60000;
const timerLoadCommonData = 60000;
const objAvailableTypes = {
	count: 'Count transactions',
	sum: 'Paid sum'
};

const $elNumberTotalSum = $('#number-total-sum');
const $elNumberTransactions = $('#number-transactions');
const $elNumberUserPaid = $('#number-users-paid');
const $elNumberUserAll = $('#number-users-all');
const $elFilterCurrency = $('#filter_currency');

const animateNumberSeparator = $.animateNumber.numberStepFactories.separator(',');

let timeoutLoadChartData;
let chart;
let currType = 'count';
let filter = {
	currency: 'all'
};

let jsonParams = common.getJsonFromUrl();
if (jsonParams.filter_currency) {
	filter.currency = jsonParams.filter_currency;
	$elFilterCurrency.val(jsonParams.filter_currency);
}

initChart();
$(() => {
	initIntervalToLoadChartData();
	initIntervalToLoadCommonData();
});

window.index = {
	actions: {
		onChangeCurrency: (el) => {
			filter.currency = el.value;
			initIntervalToLoadChartData();
		}
	}
};

function chooseType(type) {
	if (!objAvailableTypes.hasOwnProperty(type)) {
		throw new Error('undefined type');
	}
	if (currType === type) return false;

	currType = type;
	location.hash = currType;
	initIntervalToLoadChartData();
	return true;
}

function initIntervalToLoadCommonData() {
	loadCommonData();
	setTimeout(() => {
		initIntervalToLoadCommonData();
	}, timerLoadCommonData);
}

function loadCommonData() {
	$.get('/api/common')
		.then((response) => {
			// console.log('response', response);

			$elNumberTotalSum.animateNumber({
				number: Math.round(response.total_sum),
				numberStep: animateNumberSeparator
			});
			$elNumberTransactions.animateNumber({
				number: response.count_transactions,
				numberStep: animateNumberSeparator
			});
			$elNumberUserPaid.animateNumber({
				number: response.users_paid,
				numberStep: animateNumberSeparator
			});
			$elNumberUserAll.animateNumber({
				number: response.users_all,
				numberStep: animateNumberSeparator
			});

		}) // then
		.fail(handleAjaxError);
}

function initIntervalToLoadChartData() {
	loadChartData();
	if (timeoutLoadChartData) clearTimeout(timeoutLoadChartData);
	timeoutLoadChartData = setTimeout(() => {
		initIntervalToLoadChartData();
	}, timerLoadChartData);
}

function loadChartData() {
	chart.showLoading();
	let params = {};
	if (filter.currency) {
		params.filter_currency = filter.currency;
	}

	if (jsonParams.filter_currency !== params.filter_currency) {
		window.history.pushState({}, '', '?' + $.param(params));
		jsonParams.filter_currency = params.filter_currency;
	}

	$.get('/api/statistic', params)
		.then((response) => {
			// console.log('response', response);

			let arrDataTransactions = [], arrDataUsdSum = [], arrDataSum = [];
			let dateCurr, datePrev;

			const rows = response.rows;
			const lengthRows = rows.length;
			for (let i = 0; i < lengthRows; i++) {
				const row = rows[i];
				dateCurr = new Date(row.date);

				if (datePrev) {
					const diffInDays = dateDiffInDays(datePrev, dateCurr);
					if (diffInDays > 1) {
						const fakeRow = {count: 0, usd_sum: 0, sum: filter.currency !== 'all' ? 0 : undefined };
						for (let i = 1; i < diffInDays; i++) {
							let date = new Date(datePrev);
							date.setDate(date.getDate() + i);
							addDataToArrays(date.getTime(), fakeRow);
						}
					}
				}

				addDataToArrays(dateCurr.getTime(), row);

				datePrev = dateCurr;
			}

			chart.series[0].setData(arrDataTransactions);
			chart.series[1].setData(arrDataUsdSum);
			chart.series[2].setData(arrDataSum);

			chart.yAxis[2].update({
				title: {
					text: filter.currency !== 'all' ? `${filter.currency} sum of paid` : ''
				}
			});
			chart.series[2].update({
				name: filter.currency !== 'all' ? `${filter.currency} sum of paid` : ''
			});

			function addDataToArrays(time, row) {
				arrDataTransactions.push([ time, row.count ]);
				arrDataUsdSum.push([ time, row.usd_sum ]);
				arrDataSum.push([ time, row.sum ]);
			}
		}) // then
		.fail(handleAjaxError)
		.always(() => {
			chart.hideLoading();
		});
}

function handleAjaxError(jqXHR, exception) {
	let msg = '';
	if (jqXHR.status === 0) {
		msg = 'Not connect.\n Verify Network.';
	} else if (jqXHR.status === 404) {
		msg = 'Requested page not found. [404]';
	} else if (jqXHR.status === 500) {
		msg = 'Internal Server Error [500].';
	} else if (exception === 'parsererror') {
		msg = 'Requested JSON parse failed.';
	} else if (exception === 'timeout') {
		msg = 'Time out error.';
	} else if (exception === 'abort') {
		msg = 'Ajax request aborted.';
	} else {
		msg = 'Uncaught Error.\n' + jqXHR.responseText;
	}
	alert(msg);
}

function initChart() {
	Highcharts.setOptions({
		chart: {
			style: {
				color: "#333"
			}
		},
		title: {
			style: {
				color: '#333',
			}
		},

		toolbar: {
			itemStyle: {
				color: '#666'
			}
		},

		legend: {
			itemStyle: {
				font: '9pt Trebuchet MS, Verdana, sans-serif',
				color: '#A0A0A0'
			},
			itemHoverStyle: {
				color: '#FFF'
			},
			itemHiddenStyle: {
				color: '#444'
			}
		},
		labels: {
			style: {
				color: '#666'
			}
		},

		exporting: {
			enabled: true,
			buttons: {
				contextButton: {
					symbolFill: '#FFF',
					symbolStroke: '#333'
				}
			}
		},

		rangeSelector: {
			buttonTheme: {

				fill: '#FFF',
				stroke: '#333',
				style: {
					color: '#333',
				},
				states: {
					hover: {
						fill: '#666',
						stroke: '#FFF',
						style: {
							color: '#FFF',
						},
					},
					select: {
						fill: '#333',
						stroke: '#FFF',
						style: {
							color: '#FFF',
						},
					}
				}
			},
			// inputStyle: {
			// 	backgroundColor: '#333',
			// 	color: '#666'
			// },
			labelStyle: {
				color: '#666'
			}
		},

		xAxis: {
			// gridLineWidth: 1,
			// lineColor: '#000',
			// tickColor: '#000',
			labels: {
				style: {
					color: '#333',
				}
			},
			title: {
				style: {
					color: '#333',
					// fontWeight: 'bold',
					// fontSize: '12px',
				}
			}
		},
		yAxis: {
			labels: {
				style: {
					color: '#333',
				}
			},
			title: {
				style: {
					color: '#333',
				}
			}
		},

		credits: {
			enabled: false,
		}
	});
	chart = Highcharts.stockChart('container-highcharts-graph', {

		rangeSelector: {
			selected: 1
		},

		title: {
			text: 'ICO bot statistic'
		},

		xAxis: [{
			events: {
				setExtremes: (e) => {
					// console.log('click', e.trigger, e);
					if (e.trigger === 'rangeSelectorButton' || e.trigger === 'rangeSelectorInput') {
						initIntervalToLoadChartData();
					}
				}
			}
		}],
		yAxis: [{
			allowDecimals: false,
			title: {
				text: 'Count of transactions',
				style: {
					color: "#007bff"
				}
			},
			labels: {
				style: {
					color: "#007bff"
				}
			},
			opposite: false
		}, {
			allowDecimals: false,
			labels: {
				format: '${value}',
				style: {
					color: "#ff9f00"
				}
			},
			title: {
				text: 'USD sum of paid',
				style: {
					color: "#ff9f00"
				}
			},
		}, {
			allowDecimals: false,
			labels: {
				style: {
					color: "#434348"
				}
			},
			title: {
				style: {
					color: "#434348"
				}
			},
		}],

		tooltip: {
			shared: true
		},
		legend: {
			layout: 'vertical',
			align: 'left',
			x: 80,
			verticalAlign: 'top',
			y: 55,
			floating: true,
			backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
		},

		series: [{
			marker: {
				enabled: true,
				radius: 2
			},
			name: 'Count of transactions',
			data: [],
			yAxis: 0,
			tooltip: {},
			color: "#007bff"
		}, {
			marker: {
				enabled: true,
				radius: 2
			},
			name: 'USD sum of paid',
			data: [],
			yAxis: 1,
			tooltip: {
				valueDecimals: 2,
				valuePrefix: '$',
				// valueSuffix: ' USD'
			},
			color: "#ff9f00"
		}, {
			marker: {
				enabled: true,
				radius: 2
			},
			data: [],
			yAxis: 2,
			tooltip: {},
			color: "#434348"
		}]
	});
}

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}