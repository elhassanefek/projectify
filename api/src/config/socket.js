const socketIO = require('socket.io');
const authSocket = require('../socket/middleWares/authSocket');
const RoomManager = require('../socket/room');

class SocketConfig {
  constructor() {
    this.io = null;
    this.roomManager = null;
    this.userSockets = new Map();
  }

  initialize(server, options = {}) {
    const defaultOptions = {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    };

    this.io = socketIO(server, { ...defaultOptions, ...options });
    this.roomManager = new RoomManager(this.io);

    // Initialize middleware
    this.setupMiddleware();

    // Set up connection handlers
    this.setupConnectionHandlers();

    console.log('✅ Socket.IO initialized successfully');

    return this.io;
  }

  setupMiddleware() {
    this.io.use(authSocket);
  }

  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(
        ` User connected: ${socket.userId} (Socket ID: ${socket.id})`
      );

      // Track user's socket connections
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Auto-join user-specific room
      const userRoom = RoomManager.getUserRoom(socket.userId);
      this.roomManager.joinRoom(socket, userRoom);

      // Workspace join/leave
      socket.on('join:workspace', (workspaceId) => {
        const workspaceRoom = RoomManager.getWorkspaceRoom(workspaceId);
        this.roomManager.joinRoom(socket, workspaceRoom);
      });

      socket.on('leave:workspace', (workspaceId) => {
        const workspaceRoom = RoomManager.getWorkspaceRoom(workspaceId);
        this.roomManager.leaveRoom(socket, workspaceRoom);
      });

      // Project join/leave
      socket.on('join:project', (projectId) => {
        const projectRoom = RoomManager.getProjectRoom(projectId);
        this.roomManager.joinRoom(socket, projectRoom);
      });

      socket.on('leave:project', (projectId) => {
        const projectRoom = RoomManager.getProjectRoom(projectId);
        this.roomManager.leaveRoom(socket, projectRoom);
      });

      // Task join/leave
      socket.on('join:task', (taskId) => {
        const taskRoom = RoomManager.getTaskRoom(taskId);
        this.roomManager.joinRoom(socket, taskRoom);
      });

      socket.on('leave:task', (taskId) => {
        const taskRoom = RoomManager.getTaskRoom(taskId);
        this.roomManager.leaveRoom(socket, taskRoom);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(
          `❌ Disconnected: ${socket.userId} (Socket ID: ${socket.id})`
        );

        // Leave all rooms through room manager
        this.roomManager.leaveAllRooms(socket);

        // Clean up user tracking
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
    if (!this.io) {
      throw new Error('Socket.IO not initialized. Call initialize() first.');
    }
    return this.io;
  }

  // Get all sockets for a specific user
  getUserSockets(userId) {
    return Array.from(this.userSockets.get(userId) || []);
  }

  // Check if a user is online
  isUserOnline(userId) {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  // Get room manager instance
  getRoomManager() {
    return this.roomManager;
  }
}

module.exports = new SocketConfig();
