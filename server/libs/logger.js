const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const IS_DEBUG = process.env.NODE_ENV !== 'production';
const PATH_TO_LOGS = path.join(__dirname,'..','..','logs','.log');
const tsFormat = () => (new Date()).toLocaleTimeString();

module.exports = function getLogger(module) {

  if (!module) throw new Error(`Required pass "module" argument to logger!`);
  const pathTo = module.filename.split('server/')[1];

  /**
   * Will
   * write to console;
   * write to file separate by year, month and day;
   */
  let logger = new winston.Logger({
    transports: [
      new winston.transports.Console({
        timestamp: tsFormat,
        colorize: true,
        level: IS_DEBUG ? 'debug' : 'error',
        label: pathTo
      }),
      new DailyRotateFile({
        filename: PATH_TO_LOGS,
        createTree: true,
        timestamp: tsFormat,
        datePattern: '/yyyy/MM/dd/HH',
        handleExceptions: true,
        prepend: true,
        json: true,
        colorize: false,
        level: IS_DEBUG ? 'debug' : 'info',
        label: pathTo
      })
    ]
  });

  logger.stream = (type) => {
    return {
      write: (message, encoding) => {
        logger[type](message);
      }
    };
  };

  return logger;
};