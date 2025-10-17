// src/config/socket.js
const socketIO = require('socket.io');
const authSocket = require('../socket/middleWares/authSocket');

class SocketConfig {
  constructor() {
    this.io = null;
    this.userSockets = new Map();
  }

  initialize(server, options = {}) {
    const defaultOptions = {
      cors: {
        // origin: process.env.CLIENT_URL || 'http://localhost:3000',
        // methods: ['GET', 'POST'],
        // credentials: true,
        origin: '*',
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    };

    this.io = socketIO(server, { ...defaultOptions, ...options });

    // Plug in middleware
    this.setupMiddleware();

    // Handle connections
    this.setupConnectionHandlers();

    console.log('✅ Socket.IO initialized successfully');
    return this.io;
  }

  setupMiddleware() {
    // You can chain multiple middlewares here if needed
    this.io.use(authSocket);
  }

  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(
        `🔌 User connected: ${socket.userId} (Socket ID: ${socket.id})`
      );

      // Track user's socket connections
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Auto-join user-specific room
      socket.join(`user:${socket.userId}`);

      // Workspace join/leave
      socket.on('join:workspace', (workspaceId) => {
        socket.join(`workspace:${workspaceId}`);
        console.log(`👥 User ${socket.userId} joined workspace:${workspaceId}`);
      });

      socket.on('leave:workspace', (workspaceId) => {
        socket.leave(`workspace:${workspaceId}`);
        console.log(`👋 User ${socket.userId} left workspace:${workspaceId}`);
      });

      // Project join/leave
      socket.on('join:project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(`📂 User ${socket.userId} joined project:${projectId}`);
      });

      socket.on('leave:project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`📁 User ${socket.userId} left project:${projectId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(
          `❌ Disconnected: ${socket.userId} (Socket ID: ${socket.id})`
        );

        const userSocketSet = this.userSockets.get(socket.userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(socket.userId);
            console.log(`👋 User ${socket.userId} is now offline`);
          }
        }
      });

      // Error handling
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.userId}:`, error);
      });
    });
  }

  getIO() {
    if (!this.io)
      throw new Error('❌ Socket.IO not initialized. Call initialize() first.');
    return this.io;
  }

  isUserOnline(userId) {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set();
  }

  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  getConnectionCount() {
    return this.io?.sockets.sockets.size || 0;
  }
}

module.exports = new SocketConfig();
