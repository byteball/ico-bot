# ico-bot
beta



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