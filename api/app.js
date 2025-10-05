const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const workSpaceRouter = require('./routes/workSpaceRoutes');
const projectRouter = require('./routes/projectRoutes');
const authRouter = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const suoperAdminRouter = require('./routes/super-adminRoutes');
const globalErrorHandler = require('./controllers/errorContoller');
const app = express();
// set security http headers
app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json({}));

//data senitization against NOSQL query injection
app.use(
  mongoSanitize({
    onSanitize: ({ key }) => {
      console.warn(`Sanitized ${key}`);
    },
  })
);
//data  senitization against xss
app.use(xss());

//Prevent paramater polution
app.use(
  hpp({
    whitelist: [],
  })
);
//middlewares

//limit requirests from the same IP
const limiter = rateLimit({
  max: 100,
  window: 60 * 60 * 1000,
  message: 'Too many requests from this IP , please try again in an hour!',
});
app.use('/api', limiter);
//routes
app.use('/api/v1/auth', authRouter);

app.use('/api/v1/users', userRouter);

app.use('/api/v1/workSpaces', workSpaceRouter);

app.use('/api/v1/projects', projectRouter);

app.use('/api/v1/super-admin', suoperAdminRouter);
app.use(globalErrorHandler);
module.exports = app;
