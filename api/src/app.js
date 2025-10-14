const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const workSpaceRouter = require('./routes/workSpaceRoutes');
const userRouter = require('./routes/userRoutes');
const globalErrorHandler = require('./controllers/errorContoller');

const app = express();

// ---------------- Security Middlewares ----------------

// Helmet - Set security HTTP headers
if (process.env.NODE_ENV !== 'test') {
  app.use(helmet());
}

// Morgan - Request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Data sanitization against NoSQL injection
if (process.env.NODE_ENV !== 'test') {
  app.use(
    mongoSanitize({
      onSanitize: ({ key }) => {
        if (process.env.NODE_ENV === 'development')
          console.warn(`Sanitized ${key}`);
      },
    })
  );

  // Data sanitization against XSS
  app.use(xss());

  // Prevent parameter pollution
  app.use(
    hpp({
      whitelist: [],
    })
  );

  // Rate limiter
  const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!',
  });
  app.use('/api', limiter);
}

// ---------------- Routes ----------------
app.use('/api/v1/users', userRouter);
app.use('/api/v1/workSpaces', workSpaceRouter);

// ---------------- Global Error Handler ----------------
app.use(globalErrorHandler);

module.exports = app;
