// config/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketConfig {
  constructor() {
    this.io = null;
    this.userSockets = new Map();
  }

  initialize(server, options = {}) {
    const defaultOptions = {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    };

    this.io = socketIO(server, { ...defaultOptions, ...options });

    this.setupMiddleware();
    this.setupConnectionHandlers();

    console.log('✅ Socket.IO initialized successfully');
    return this.io;
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        socket.userId = decoded.id || decoded.userId;
        socket.user = decoded;

        next();
      } catch (error) {
        console.error('❌ Socket authentication error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  //handle socket connection and disconnection
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(
        `🔌 User connected: ${socket.userId} (Socket ID: ${socket.id})`
      );

      // Track user's socket connection
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Automatically join user's personal room for notifications
      socket.join(`user:${socket.userId}`);

      // Handle joining workspace rooms
      socket.on('join:workspace', (workspaceId) => {
        socket.join(`workspace:${workspaceId}`);
        console.log(`User ${socket.userId} joined workspace:${workspaceId}`);
      });

      // Handle joining project rooms
      socket.on('join:project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(` User ${socket.userId} joined project:${projectId}`);
      });

      // Handle leaving workspace
      socket.on('leave:workspace', (workspaceId) => {
        socket.leave(`workspace:${workspaceId}`);
        console.log(`User ${socket.userId} left workspace:${workspaceId}`);
      });

      // Handle leaving project
      socket.on('leave:project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`User ${socket.userId} left project:${projectId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(
          `🔌 User disconnected: ${socket.userId} (Socket ID: ${socket.id})`
        );

        // Remove this socket from user's socket set
        const userSocketSet = this.userSockets.get(socket.userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          // If user has no more connections, remove from map
          if (userSocketSet.size === 0) {
            this.userSockets.delete(socket.userId);
            console.log(`👋 User ${socket.userId} is now offline`);
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  /**
   * Get the Socket.IO instance
   * Use this in your services to emit events
   */
  getIO() {
    if (!this.io) {
      throw new Error('❌ Socket.IO not initialized. Call initialize() first.');
    }
    return this.io;
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(userId) {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  /**
   * Get all socket IDs for a specific user
   * Useful when user has multiple tabs/devices open
   */
  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set();
  }

  /**
   * Get all currently online users
   */
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get total number of connected sockets
   */
  getConnectionCount() {
    return this.io?.sockets.sockets.size || 0;
  }
}

// Export singleton instance
module.exports = new SocketConfig();
