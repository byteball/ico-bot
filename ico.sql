CREATE TABLE receiving_addresses (
	receiving_address VARCHAR(100) NOT NULL PRIMARY KEY,
	currency VARCHAR(10) NOT NULL, -- GBYTE, ETH, BTC
	device_address CHAR(33) NOT NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE (device_address, currency),
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);

CREATE TABLE user_addresses (
	device_address CHAR(33) NOT NULL,
	platform CHAR(50) NOT NULL, -- BYTEBALL, ETHEREUM, BITCOIN
	address CHAR(100) NOT NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(device_address,platform),
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);

CREATE TABLE transactions (
	transaction_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	txid VARCHAR(100) NOT NULL UNIQUE, -- id of receiving tx on the receiving currency
	receiving_address VARCHAR(100) NOT NULL, -- our receiving address in input currency
	currency VARCHAR(10) NOT NULL, -- GBYTE, BTC, ETH, USDT
	byteball_address CHAR(32) NOT NULL, -- user's byteball address that will receive new tokens (out address)
	device_address CHAR(33) NULL,
	currency_amount DECIMAL(14,9) NOT NULL, -- in input currency
	tokens INT,
	refunded INT DEFAULT 0,
	paid_out INT NOT NULL DEFAULT 0,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	paid_date TIMESTAMP,
	refund_date TIMESTAMP,
	payout_unit CHAR(44) NULL,
	refund_txid CHAR(100) NULL,
	stable TINYINT DEFAULT 0,
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address),
	FOREIGN KEY (payout_unit) REFERENCES units(unit)
);
CREATE INDEX txid_stable ON transactions (stable);

/*
upgrade:
CREATE UNIQUE INDEX txid_index ON transactions (txid);
CREATE INDEX txid_stable ON transactions (stable);
ALTER TABLE transactions ADD COLUMN stable TINYINT DEFAULT 0;
-- ALTER TABLE receiving_addresses ADD COLUMN creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE user_addresses (
	device_address CHAR(33) NOT NULL,
	platform CHAR(50) NOT NULL,
	address CHAR(100)  NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(device_address,platform),
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);
INSERT INTO user_addresses (device_address, platform, address)
SELECT device_address, 'BYTEBALL', byteball_address FROM users;
DROP TABLE users;
*/
