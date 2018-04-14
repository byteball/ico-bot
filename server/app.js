const path = require('path');
const express = require('express');
const routes = require('./routes/index');
const morgan = require('./mw/morgan');
const cors = require('./mw/cors');
const conf = require('byteballcore/conf');

const app = express();
module.exports = app;

// to send static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// to log next routes
app.use(morgan.err);
app.use(morgan.out);

if (conf.bCorsEnabled) {
  app.use(cors());
}
// api routes
app.use('/api', routes);