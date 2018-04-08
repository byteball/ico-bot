class Table {
	constructor(options, $elHead, $elBody, $elPagination = null) {
		this.data = Object.assign({
			url: null,
			urlParams: {},
			page: 1,
			limit: 10,
			filter: {},
			filterFormat: {},
			jsonUrlFilterFormat: {},
			sort: null,
			rows: [],
			totalItems: 0,
		}, options.data || {});
		this.params = options.params;

		this.$elHead = $elHead;
		this.$elBody = $elBody;
		this.$elPagination = $elPagination;

		this.actions = new TableActions(this);
	}

	loadData() {
		let params = {
			page: this.data.page,
			limit: this.data.limit,
		};
		if (this.data.sort) params.sort = this.data.sort;
		Object.assign(params, this.data.urlParams, this.data.filter);
		if (this.data.filterFormat) {
			let filterFormats = this.data.filterFormat;
			for (let key in filterFormats) {
				if (!filterFormats.hasOwnProperty(key) || !params.hasOwnProperty(key)) continue;
				params[key] = filterFormats[key](params[key]);
			}
		}
		// console.log('params', $.param(params));

		window.history.pushState( {} , '', '?' + $.param(params));

		$.get(this.data.url, params)
			.then((response) => {
				// console.log('response', response);

				this.data.rows = response.rows;
				this.data.totalItems = response.total;
				this.data.totalRows = Math.ceil(this.data.totalItems / this.data.limit);
				this.createHeader();
				this.createBody();
				this.createPagination();
			})
			.fail(handleAjaxError)
			.always(() => {

			});
	}

	createHeader() {
		$('tr', this.$elHead).remove();
		let strTh = '<tr>';
		for (let key in this.params) {
			if (!this.params.hasOwnProperty(key)) continue;
			let val = this.params[key];
			let title = key;
			// console.log('createHeader', key, val);
			let classes = {};

			if (val.head) {
				const head = val.head;
				if (head.hasOwnProperty('isAvailable')) {
					if (typeof head.isAvailable === 'function') {
						if (!head.isAvailable()) continue;
					} else if (!head.isAvailable) continue;
				}
				if (head.title) {
					title = head.title;
				}
				if (head.sort) {
					classes.sort = true;
					if (head.sort.used) {
						classes['sort--used'] = true;
					}
				}
			}

			const strClass = Object.keys(classes).filter((key, index) => {
				return !!classes[key];
			}).join(' ');
			strTh += `<th id="t_s_${key}" name="${key}" scope="col" class="${strClass}" onclick="table.actions.onChangeSort(this)">${title}</th>`;
		}
		strTh += '</tr>';

		this.$elHead.append(strTh);
	}

	createBody() {
		$('tr', this.$elBody).remove();
		const rows = this.data.rows;
		if (rows.length) {
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				let strTr = '<tr>';

				for (let key in this.params) {
					if (!this.params.hasOwnProperty(key)) continue;
					const tItem = this.params[key];
					let val = row[key] ? row[key] : '-';
					if (tItem.body) {
						const body = tItem.body;
						if (body.hasOwnProperty('isAvailable')) {
							if (typeof body.isAvailable === 'function') {
								if (!body.isAvailable()) continue;
							} else if (!body.isAvailable) continue;
						}
						if (body.format) {
							val = body.format(val, row);
						}
					}
					strTr += `<td>${val}</td>`;
				}

				strTr += '</tr>';
				this.$elBody.append(strTr);
			}
		} else {
			let strTr = `<tr><td colspan="${Object.keys(this.params).length}">data not found</td></tr>`;
			this.$elBody.append(strTr);
		}
	}

	createPagination() {
		if (!this.$elPagination) return;
		$('li', this.$elPagination).remove();
		const totalRows = this.data.totalRows;
		const currPage = this.data.page;
		// prev page
		let str = `<li class="page-item"><a class="page-link" onclick="table.actions.onChangePage(${currPage > 1 ? currPage - 1 : 1})" aria-label="Previous"><span aria-hidden="true">&laquo;</span><span class="sr-only">Previous</span></a></li>`;
		// first page
		str += this.getPaginationLi(1, currPage === 1);
		if (totalRows > 1) {
			let nFrom = 2, nTo = 6, isNeedRightSpread = false;
			if (totalRows <= 7) {
				nTo = totalRows - 1;
			} else {
				if (currPage > 4) {
					str += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
					nFrom = currPage - 1;
					if (currPage < (totalRows - 3)) {
						isNeedRightSpread = true;
						nTo = currPage + 1;
					} else {
						nFrom = totalRows - 4;
						nTo = totalRows - 1;
					}
				} else {
					isNeedRightSpread = true;
					nTo = 5;
				}
			}
			// middle numbers
			for (let i = nFrom; i <= nTo; i++) {
				str += this.getPaginationLi(i, currPage === i);
			}
			if (isNeedRightSpread) {
				str += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
			}
			// last page
			str += this.getPaginationLi(totalRows, currPage === totalRows);
		}
		// next page
		str += `<li class="page-item"><a class="page-link" onclick="table.actions.onChangePage(${currPage < totalRows ? currPage + 1 : totalRows})" aria-label="Next"><span aria-hidden="true">&raquo;</span><span class="sr-only">Next</span></a></li>`;
		this.$elPagination.append(str);
	}

	getPaginationLi(number, isActive) {
		return `<li class="page-item ${isActive ? 'active' : ''}"><a class="page-link" onclick="table.actions.onChangePage(${number})">${number}</a></li>`;
	}

	checkIsWasChangedUrlParams() {
		let jsonParams = common.getJsonFromUrl();
		let isWasChanged = false;

		if (jsonParams.page) {
			jsonParams.page = Number(jsonParams.page);
			if (jsonParams.page !== this.data.page) {
				this.data.page = jsonParams.page;
				isWasChanged = true;
			}
		}
		if (jsonParams.limit) {
			jsonParams.limit = Number(jsonParams.limit);
			if (jsonParams.limit !== this.data.limit) {
				this.data.limit = jsonParams.limit;
				$('#t_limit').val(this.data.limit);
				isWasChanged = true;
			}
		}
		if (jsonParams.sort) {
			let val = jsonParams.sort;
			if (this.data.sort !== val) {
				this.data.sort = val;
				if (this.params[val] && this.params[val].head && this.params[val].head.sort) {
					this.params[val].head.sort.used = true;
					$(`#t_s_${val}`).addClass('sort--used');
				}
				for (let key in this.params) {
					if (!this.params.hasOwnProperty(key) || key === val) continue;
					if (this.params[key].head && this.params[key].head.sort) {
						this.params[key].head.sort.used = false;
						$(`#t_s_${key}`).removeClass('sort--used');
					}
				}
			}
		}

		for (let key in jsonParams) {
			if (!jsonParams.hasOwnProperty(key) || key.indexOf('f_') !== 0) continue;
			let value = jsonParams[key];

			let prevValue;
			if (this.data.jsonUrlFilterFormat[key] && this.data.jsonUrlFilterFormat[key].toStr) {
				prevValue = this.data.jsonUrlFilterFormat[key].toStr(this.data.filter[key]);
			} else {
				prevValue = this.data.filter[key];
			}

			if (prevValue !== value) {
				if (this.data.jsonUrlFilterFormat[key] && this.data.jsonUrlFilterFormat[key].toVal) {
					this.data.filter[key] = this.data.jsonUrlFilterFormat[key].toVal(value);
				} else {
					this.data.filter[key] = value;
				}
				if (this.data.jsonUrlFilterFormat[key] && this.data.jsonUrlFilterFormat[key].update) {
					this.data.jsonUrlFilterFormat[key].update(value);
				} else {
					$(`#t_${key}`).val(value);
				}
				isWasChanged = true;
			}
		}
		let prevFilters = this.data.filter;
		for (let key in prevFilters) {
			if (!prevFilters.hasOwnProperty(key)) continue;
			if (!jsonParams[key]) {
				delete prevFilters[key];
				$(`#t_${key}`).val('');
				isWasChanged = true;
			}
		}

		return isWasChanged;
	}
}

class TableActions {
	constructor(table) {
		this.table = table;
	}

	onChangeFilter(el) {
		// console.log('onChangeFilter el', el, el.name, el.value);
		let prevValue = this.table.data.filter[el.name];
		if (prevValue === el.value || (!el.value && !prevValue)) return;
		if (!el.value) {
			delete this.table.data.filter[el.name];
		} else {
			this.table.data.filter[el.name] = el.value;
		}
		this.table.data.page = 1;
		this.table.loadData();
	}
	onKeyEnter(event) {
		if (event.keyCode !== 13) return;
		// console.log('onKeyEnter el', event);
		const el = event.target;
		this.onChangeFilter(el);
	}
	onChangePage(page) {
		// console.log('onChangePage el', page);
		let prevPage = this.table.data.page;
		if (prevPage === page) return;
		this.table.data.page = page;
		this.table.loadData();
	}
	onChangeSort(el) {
		// console.log('onChangeSort el', el);
		if (!el.classList.contains('sort')) return;
		if (el.classList.contains('sort--used')) return;
		let val = el.getAttribute('name');
		if (this.table.params[val] && this.table.params[val].head) {
			this.table.params[val].head.used = true;
			$(`#t_s_${val}`).addClass('sort--used');
		}
		for (let key in this.table.params) {
			if (!this.table.params.hasOwnProperty(key) || key === val) continue;
			if (this.table.params[key].head) {
				this.table.params[key].head.used = false;
				$(`#t_s_${key}`).removeClass('sort--used');
			}
		}
		this.table.data.sort = val;
		this.table.loadData();
	}
	onChangeLimit(el) {
		// console.log('onChangeLimit el', el, el.value);
		let prevValue = this.table.data.limit;
		if (prevValue === el.value) return;
		this.table.data.limit = el.value;
		this.table.data.page = 1;
		this.table.loadData();
	}
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

window.Table = Table;