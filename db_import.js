/*jslint node: true */
'use strict';
const fs = require('fs');
const db = require('ocore/db.js');

let db_sql = fs.readFileSync('ico.sql', 'utf8');
db_sql.split('-- query separator').forEach(function(sql) {
	if (sql) {
		db.query(sql, [], (rows) => {
			console.log(sql);
		});
	}
});