const express = require('express');
const tenantRouter = require('./routes/tenantRoutes');
const projectRouter = require('./routes/projectRoutes');
const app = express();

//routes
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/projects', projectRouter);

module.exports = app;
