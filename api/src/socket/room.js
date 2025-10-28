class RoomManager {
  constructor(io) {
    this.io = io;
  }

  static getUserRoom(userId) {
    return `user:${userId}`;
  }

  static getWorkspaceRoom(workspaceId) {
    return `workspace:${workspaceId}`;
  }
  static getTaskRoom(taskId) {
    return `task:${taskId}`;
  }

  static getProjectRoom(projectId) {
    return `project:${projectId}`;
  }

  // Join a room
  joinRoom(socket, roomName) {
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined ${roomName}`);
  }

  // Leave a room
  leaveRoom(socket, roomName) {
    socket.leave(roomName);
    console.log(`👋 Socket ${socket.id} left ${roomName}`);
  }
  leaveAllRooms(socket) {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomName) => {
      if (roomName !== socket.id) {
        // Don't leave own room
        this.leaveRoom(socket, roomName);
      }
    });
  }

  // Emit to a specific room
  emitToRoom(roomName, event, payload) {
    this.io.to(roomName).emit(event, payload);
  }

  // Emit to a specific user
  emitToUser(userId, event, payload) {
    const room = RoomManager.getUserRoom(userId);
    this.emitToRoom(room, event, payload);
  }

  // Emit to a workspace
  emitToWorkspace(workspaceId, event, payload) {
    const room = RoomManager.getWorkspaceRoom(workspaceId);
    this.emitToRoom(room, event, payload);
  }

  // Emit to a project
  emitToProject(projectId, event, payload) {
    const room = RoomManager.getProjectRoom(projectId);
    this.emitToRoom(room, event, payload);
  }
}

module.exports = RoomManager;
