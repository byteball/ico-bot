const path = require('path');
const express = require('express');
const routes = require('./routes/index');
const morgan = require('./mw/morgan');

const app = express();
module.exports = app;

// to send static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// to log next routes
app.use(morgan.err);
app.use(morgan.out);

// api routes
app.use('/api', routes);