/*jslint node: true */
'use strict';
const conf = require('ocore/conf');

const REFRESH_TIMEOUT = 300*1000;
let assocQueryTimestamps = {};

function updateAttestationsInLight(address){
	if (!conf.bLight)
		throw Error('updateAttestationsInLight should be only called in light');
	return new Promise(resolve => {
		if (assocQueryTimestamps[address] && assocQueryTimestamps[address] > Date.now() - REFRESH_TIMEOUT){
			console.log('attestations of address '+address+' updated recently');
			return resolve();
		}
		const network = require('ocore/network.js');
		network.requestFromLightVendor('light/get_attestations', {address: address}, (ws, request, response) => {
			if (response.error){
				console.log('light/get_attestations failed: '+response.error);
				return resolve();
			}
			let arrAttestations = response;
			if (!Array.isArray(arrAttestations)){
				console.log('light/get_attestations response is not an array: '+response);
				return resolve();
			}
			if (arrAttestations.length === 0){
				console.log('no attestations of address'+address);
				assocQueryTimestamps[address] = Date.now();
				return resolve();
			}
			console.log('attestations', arrAttestations);
			let arrUnits = arrAttestations.map(attestation => attestation.unit);
			network.requestProofsOfJointsIfNewOrUnstable(arrUnits, err => {
				if (err){
					console.log('requestProofsOfJointsIfNewOrUnstable failed: '+err);
					return resolve();
				}
				assocQueryTimestamps[address] = Date.now();
				resolve();
			});
		});
	});
}

function purgeQueryTimestamps(){
	for (let address in assocQueryTimestamps)
		if (assocQueryTimestamps[address] <= Date.now() - REFRESH_TIMEOUT)
			delete assocQueryTimestamps[address];
}

setInterval(purgeQueryTimestamps, REFRESH_TIMEOUT);

exports.updateAttestationsInLight = updateAttestationsInLight;

