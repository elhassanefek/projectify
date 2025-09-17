const express = require('express');

const app = express();

app.use('/', (req, res, next) => {
  console.log('hello from the server');
  next();
});

module.exports = app;
