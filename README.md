# ICO Bot

This bot allows to run an ICO on Byteball network.  It accepts Bytes and Ether (also BTC in the future) from users and sends back the new tokens in exchange.  You set the prices relative to USD or other fiat or crypto currencies. 

## Install

Install node.js, clone the repository, then say
```sh
npm install
```

## Run

### Before the ICO

First, you need to sync your node
```sh
node sync.js
```
It will take about 2 days on SSD.

The bot is based on [headless wallet](../../headless-byteball), see its documentation too to understand what options you have.  Note that the default config enables TOR for security reasons, you need to have a TOR service running on your machine or disable TOR in conf.

Edit conf.js or conf.json to describe the properties of your token and token sale.

Chat with the bot, learn its address and pay a small amount (at least 3000 bytes) to fund asset issuance.  You’ll see the balance only when it is fully synced.

When it is synced, cd to `scripts` and run
```sh
node issue_tokens.js
```
Don't kill the script too early and follow its output.  It first creates a definition of the new token, waits for confirmation, then actually issues it.

### Start the ICO

When issuance is done, run
```sh
node ico.js
```
Thereafter, you start the daemon only with ico.js.  Now, the bot is ready to accept payments.

### After the ICO

Cd to `scripts`.  Burn the remaining tokens:
```sh
node burn_remaining_tokens.js
```
If you failed to reach your target, refund:
```sh
node refund.js
```
If you chose one-time distribution (rather than sending tokens back to users immediately after receiving the payment), run the distribution script:
```sh
node run_one_time_distribution.js
```

## Ethereum

### Install
1) Install [geth](https://github.com/ethereum/go-ethereum/wiki/Installing-Geth#install-on-macos-via-homebrew)


### Start
Start dev node
```bash
$ geth --dev --mine --minerthreads 1 --ws --wsorigins "*" --wsapi "db,eth,net,web3,personal,miner"
```

Start Ropsten test network node
```bash
$ geth --testnet --ws --wsorigins "*" --wsapi "admin,db,eth,net,web3,personal" --cache=1024
```

Start Main network node
```bash
$ geth --ws --wsorigins "*" --wsapi "admin,db,eth,net,web3,personal" --cache=1024
```