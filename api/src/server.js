const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! ⚠️   SHUTTING DOWN...');
  console.log(err.name, err.message);
  process.exit(1);
});
const app = require('./app');

const connectDB = require('./config/db');

if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}...`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
