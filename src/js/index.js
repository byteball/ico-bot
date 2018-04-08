const timerLoadChartData = 60000;
const timerLoadCommonData = 60000;
const objAvailableTypes = {
	count: 'Count transactions',
	sum: 'Paid sum'
};

const $btnCountType = $('#btn-count-type');
const $btnSumType = $('#btn-sum-type');
const $elNumberSum = $('#number-sum');
const $elNumberTransactions = $('#number-transactions');
const $elNumberUserPaid = $('#number-users-paid');
const $elNumberUserAll = $('#number-users-all');
const $elFilterCurrency = $('#t_f_currency');

const animateNumberSeparator = $.animateNumber.numberStepFactories.separator(',');

let timeoutLoadChartData;
let chart;
let currType = 'count';
let filter = {
	currency: 'all'
};

let jsonParams = common.getJsonFromUrl();
if (jsonParams.f_currency) {
	filter.currency = jsonParams.f_currency;
	$elFilterCurrency.val(jsonParams.f_currency);
}
filter.currency !== 'all' ? $btnSumType.show() : $btnSumType.hide();

if(window.location.hash) {
	currType = window.location.hash.substring(1);
	if (!objAvailableTypes.hasOwnProperty(currType)) {
		currType = 'count';
	}
}
$(`#btn-${currType}-type`).addClass('active');

$btnCountType.click((event) => {
	if (chooseType('count')) {
		$btnCountType.addClass('active');
		$btnSumType.removeClass('active');
		chart.series[0].update({
			name: objAvailableTypes[currType],
			tooltip: {
				valueDecimals: 0,
				valuePrefix: null,
				valueSuffix: null
			}
		});
	}
});
$btnSumType.click((event) => {
	if (chooseType('sum')) {
		$btnSumType.addClass('active');
		$btnCountType.removeClass('active');
		chart.series[0].update({
			name: objAvailableTypes[currType],
			tooltip: {
				valueDecimals: 2,
				// valuePrefix: '$',
				// valueSuffix: ' USD'
			}
		});
	}
});

initChart();
$(() => {
	initIntervalToLoadChartData();
	initIntervalToLoadCommonData();
});

window.index = {
	actions: {
		onChangeCurrency: (el) => {
			filter.currency = el.value;
			if (filter.currency !== 'all') {
				$btnSumType.show();
			} else {
				currType = 'count';
				$btnCountType.addClass('active');
				$btnSumType.removeClass('active');
				$btnSumType.hide();
			}
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

			$elNumberSum.animateNumber({
				number: Math.round(response.common_sum),
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
		params.f_currency = filter.currency;
	}

	if (jsonParams.f_currency !== params.f_currency) {
		window.history.pushState({}, '', '?' + $.param(params));
		jsonParams.f_currency = params.f_currency;
	}

	$.get('/api/statistic', params)
		.then((response) => {
			// console.log('response', response);

			let data = [];
			const rows = response.rows;
			const lengthRows = rows.length;
			for (let i = 0; i < lengthRows; i++) {
				const row = rows[i];
				data.push([ (new Date(row.date)).getTime(), row[currType] ]);
			}

			chart.series[0].setData(data);
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

		xAxis: {
			events: {
				setExtremes: (e) => {
					// console.log('click', e.trigger, e);
					if (e.trigger === 'rangeSelectorButton' || e.trigger === 'rangeSelectorInput') {
						initIntervalToLoadChartData();
					}
				}
			}
		},

		series: [{
			name: objAvailableTypes[currType],
			data: [],
			tooltip: {},
			color: "#007bff"
		}]
	});
}