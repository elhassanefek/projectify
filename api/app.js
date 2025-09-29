const express = require('express');
const tenantRouter = require('./routes/tenantRoutes');
const projectRouter = require('./routes/projectRoutes');
const authRouter = require('./routes/authRoutes');
const app = express();
app.use(express.json());
//routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/projects', projectRouter);

module.exports = app;
