
const eventBus = require('byteballcore/event_bus.js');
const conversion = require('./conversion');

let bRatesReady = false;

conversion.onceReady(() => {
  console.log('########################################ß');
  bRatesReady = true;
  const headlessWallet = require('headless-byteball'); // start loading headless only when rates are ready
  checkRatesAndHeadless();
});

var bHeadlessReady = false;
eventBus.once('headless_wallet_ready', () => {
	bHeadlessReady = true;
	checkRatesAndHeadless();
});

function checkRatesAndHeadless() {
	if (bRatesReady && bHeadlessReady) {
    eventBus.emit('headless_and_rates_ready');
  }
}

module.exports = conversion;