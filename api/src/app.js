const express = require('express');
// const helmet = require('helmet');
// const mongoSanitize = require('express-mongo-sanitize');
// const xss = require('xss-clean');
// const morgan = require('morgan');
// const hpp = require('hpp');
// const rateLimit = require('express-rate-limit');
const workSpaceRouter = require('./routes/workSpaceRoutes');

const userRouter = require('./routes/userRoutes');
// const superAdminRouter = require('./routes/super-adminRoutes');
const globalErrorHandler = require('./controllers/errorContoller');

const app = express();

// Set security HTTP headers
// app.use(helmet());

// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

app.use(express.json({}));

// Data sanitization against NoSQL query injection
// app.use(
//   mongoSanitize({
//     onSanitize: ({ key }) => {
//       console.warn(`Sanitized ${key}`);
//     },
//   })
// );

// Data sanitization against XSS
// app.use(xss());

// Prevent parameter pollution
// app.use(
//   hpp({
//     whitelist: [],
//   })
// );

// Limit requests from the same IP
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000, // Changed from 'window' to 'windowMs'
//   message: 'Too many requests from this IP, please try again in an hour!',
// });
// app.use('/api', limiter);

// Routes
app.use('/api/v1/users', userRouter);
app.use('/api/v1/workSpaces', workSpaceRouter);

// app.use('/api/v1/super-admin', superAdminRouter);

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
