// server.js
const dotenv = require('dotenv');
const http = require('http');
const socketConfig = require('./config/socket');
const SocketService = require('./services/socketService');
const eventBus = require('./utils/eventBus'); // Assuming you have an event bus
const registerEventHandlers = require('./events/registerHandlers');
dotenv.config({ path: './config.env' });

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! ⚠️  SHUTTING DOWN...');
  console.log(err.name, err.message);
  process.exit(1);
});

const app = require('./app');
const connectDB = require('./config/db');

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const server = http.createServer(app);

// Initialize socket configuration
socketConfig.initialize(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});
const io = socketConfig.getIO();
const roomManager = socketConfig.getRoomManager();
// Initialize SocketService with the configured io and roomManager
const socketService = new SocketService(io, roomManager);

// Register all socket event handlers
registerEventHandlers(eventBus, socketService);
// Register other handlers as needed
// require('./socket/handlers/userHandlers')(eventBus, socketService);
// require('./socket/handlers/workspaceHandlers')(eventBus, socketService);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=================================');
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
