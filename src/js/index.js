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

			let arrDataTransactions = [], arrDataSum = [];
			const rows = response.rows;
			const lengthRows = rows.length;
			for (let i = 0; i < lengthRows; i++) {
				const row = rows[i];
				const time = (new Date(row.date)).getTime();
				arrDataTransactions.push([ time, row.count ]);
				arrDataSum.push([ time, row.usd_sum ]);
			}

			chart.series[0].setData(arrDataTransactions);
			chart.series[1].setData(arrDataSum);
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
			labels: {
				format: '${value}',
				style: {
					color: "#ff9f00"
				}
			},
			title: {
				text: 'Sum of paid',
				style: {
					color: "#ff9f00"
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
			name: 'Count of transactions',
			data: [],
			yAxis: 0,
			tooltip: {},
			color: "#007bff"
		}, {
			name: 'Sum of paid',
			data: [],
			yAxis: 1,
			tooltip: {
				valueDecimals: 2,
				valuePrefix: '$',
				// valueSuffix: ' USD'
			},
			color: "#ff9f00"
		}]
	});
}