/*jslint node: true */
'use strict';
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');


function getDiscount(user_address){
	return new Promise(async (resolve) => {
		if (!conf.discounts)
			return resolve({discount: 0});
		var arrAttestorAddresses = Object.keys(conf.discounts);
		if (arrAttestorAddresses.length === 0)
			return resolve({discount: 0});
		if (conf.bLight){
			const light_attestations = require('./light_attestations.js');
			await light_attestations.updateAttestationsInLight(user_address);
		}
		let assocFieldsByAttestor = {};
		for (let attestor_address in conf.discounts){
			let objLevel = conf.discounts[attestor_address].discount_levels[0];
			for (let key in objLevel){
				if (key !== 'discount')
					assocFieldsByAttestor[attestor_address] = key;
			}
		}
		db.query(
			`SELECT attestor_address, payload 
			FROM attestations CROSS JOIN unit_authors USING(unit) CROSS JOIN messages USING(unit, message_index) 
			WHERE attestations.address=? AND unit_authors.address IN(?)`, 
			[user_address, arrAttestorAddresses],
			rows => {
				if (rows.length === 0)
					return resolve({discount: 0});
				let discount = 0;
				let domain, field, threshold_value;
				rows.forEach(row => {
					let payload = JSON.parse(row.payload);
					if (payload.address !== user_address)
						throw Error("wrong payload address "+payload.address+", expected "+user_address);
					let profile = payload.profile;
					let attested_field = assocFieldsByAttestor[row.attestor_address];
					if (!(attested_field in profile)) // likely private attestation
						return;
					let value = profile[attested_field];
					let arrDiscountLevels = conf.discounts[row.attestor_address].discount_levels;
					arrDiscountLevels.forEach(objLevel => {
						if (!(attested_field in objLevel))
							throw Error("bad discount setting "+JSON.stringify(objLevel));
						let min_value = objLevel[attested_field];
						if (value >= min_value && objLevel.discount > discount){
							discount = objLevel.discount;
							domain = conf.discounts[row.attestor_address].domain;
							threshold_value = min_value;
							field = attested_field;
						}
					});
				});
				resolve({discount, domain, threshold_value, field});
			}
		);
	});
}

exports.getDiscount = getDiscount;

