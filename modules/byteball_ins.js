/*jslint node: true */
'use strict';
const eventBus = require('byteballcore/event_bus');
const db = require('byteballcore/db.js');

var main_address;

function readMainAddress(onDone){
	if (main_address)
		return onDone();
	db.query("SELECT address FROM my_addresses WHERE address_index=0 AND is_change=0", rows => {
		if (rows.length !== 1)
			throw Error("no main address");
		main_address = rows[0].address;
		onDone();
	});
}

eventBus.on('my_transactions_became_stable', arrUnits => {
	db.query(
		"SELECT byteball_address, ethereum_address, receiving_address, outputs.asset, outputs.amount, device_address, unit \n\
		FROM outputs \n\
		JOIN receiving_addresses ON receiving_addresses.receiving_address = outputs.address \n\
		JOIN users USING(device_address) \n\
		WHERE unit IN(?) AND asset IS NULL \n\
			AND NOT EXISTS (SELECT 1 FROM unit_authors CROSS JOIN my_addresses USING(address) WHERE unit_authors.unit=outputs.unit)", 
		[arrUnits], 
		rows => {
			// note that we can have our txs in multiple outputs of the same unit
			rows.forEach(row => {
				eventBus.emit('in_transaction_stable', {
			 		txid: row.unit,
					currency_amount: row.amount/1e9,
					currency: 'GBYTE',
					byteball_address: row.byteball_address,
					ethereum_address: row.ethereum_address,
					device_address: row.device_address,
					receiving_address: row.receiving_address
				});
			});
		}
	);
	// when sent to our main address (without chat), send tokens back to the first author address
	readMainAddress(() => {
		db.query(
			"SELECT amount, unit, (SELECT address FROM unit_authors WHERE unit_authors.unit=outputs.unit LIMIT 1) AS author_address \n\
			FROM outputs \n\
			WHERE unit IN(?) AND asset IS NULL AND address=? \n\
				AND NOT EXISTS (SELECT 1 FROM unit_authors CROSS JOIN my_addresses USING(address) WHERE unit_authors.unit=outputs.unit)", 
			[arrUnits, main_address], 
			rows => {
				// note that we can have our txs in multiple outputs of the same unit
				rows.forEach(row => {
					eventBus.emit('in_transaction_stable', {
						txid: row.unit,
						currency_amount: row.amount/1e9,
						currency: 'GBYTE',
						byteball_address: row.author_address,
						device_address: null,
						receiving_address: main_address
					});
				});
			}
		);
	});
});

eventBus.on('new_my_transactions', (arrUnits) => {
	let device = require('byteballcore/device.js');
	db.query(
		"SELECT outputs.amount, outputs.asset AS received_asset, device_address \n\
		FROM outputs JOIN receiving_addresses ON outputs.address=receiving_addresses.receiving_address \n\
		WHERE unit IN(?) AND NOT EXISTS (SELECT 1 FROM unit_authors CROSS JOIN my_addresses USING(address) WHERE unit_authors.unit=outputs.unit)",
		[arrUnits],
		rows => {
			rows.forEach(row => {
				if (row.received_asset !== null)
					return device.sendMessageToDevice(row.device_address, 'text', "Received payment in wrong asset");
				eventBus.emit('new_in_transaction', {
					currency_amount: row.amount/1e9,
					currency: 'GBYTE',
					device_address: row.device_address
				});
			});
		}
	);
});

exports.readOrAssignReceivingAddress = (device_address, cb) => {
	const mutex = require('byteballcore/mutex.js');
	mutex.lock([device_address], unlock => {
		db.query("SELECT receiving_address FROM receiving_addresses WHERE device_address=? AND currency='GBYTE'", [device_address], rows => {
			if (rows.length > 0){
				cb(rows[0].receiving_address);
				return unlock();
			}
			const headlessWallet = require('headless-byteball');
			headlessWallet.issueNextMainAddress(receiving_address => {
				db.query(
					"INSERT INTO receiving_addresses (receiving_address, currency, device_address) VALUES(?,?,?)",
					[receiving_address, 'GBYTE', device_address],
					() => {
						cb(receiving_address);
						unlock();
					}
				);
			});
		});
	});
};

readMainAddress(() => {
	console.error("==== Main address: "+main_address);
});

