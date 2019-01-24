#!/bin/sh
sed -ie "s/version = '1.0'/version = '1.0t'/; s/alt = '1'/alt = '2'/" node_modules/ocore/constants.js
sed -ie "s/.hub = 'obyte.org\/bb'/.hub = 'obyte.org\/bb-test'/" conf.js
