class SocketService {
  constructor(io, roomManager) {
    if (!io) {
      throw new Error('SocketService requires an io instance');
    }
    if (!roomManager) {
      throw new Error('SocketService requires a roomManager instance');
    }
    this.io = io;
    this.roomManager = roomManager;
  }

  emitToUsers(userIds, event, data) {
    try {
      const users = Array.isArray(userIds) ? userIds : [userIds];

      users.forEach((userId) => {
        this.roomManager.emitToUser(userId, event, data);
      });

      // console.log(`📤 Emitted '${event}' to ${users.length} user(s)`);
      return { success: true, userIds: users, event };
    } catch (error) {
      // console.error(`❌ Error emitting to users:`, error);
      return { success: false, error: error.message };
    }
  }

  emitToWorkspace(workspaceId, event, data) {
    try {
      this.roomManager.emitToWorkspace(workspaceId, event, data);

      // console.log(`📤 Emitted '${event}' to workspace:${workspaceId}`);
      return { success: true, workspaceId, event };
    } catch (error) {
      // console.error(`❌ Error emitting to workspace:`, error);
      return { success: false, error: error.message };
    }
  }

  emitToProject(projectId, event, data) {
    try {
      this.roomManager.emitToProject(projectId, event, data);

      // console.log(`📤 Emitted '${event}' to project:${projectId}`);
      return { success: true, projectId, event };
    } catch (error) {
      // console.error(`❌ Error emitting to project:`, error);
      return { success: false, error: error.message };
    }
  }

  /*
   * Emit event to all connected clients
   * Use sparingly: System-wide announcements only
   */
  emitToAll(event, data) {
    try {
      this.io.emit(event, data);

      // console.log(`📤 Emitted '${event}' to all clients`);
      return { success: true, event };
    } catch (error) {
      // console.error(`❌ Error emitting to all:`, error);
      return { success: false, error: error.message };
    }
  }

  broadcastToProject(projectId, excludeUserId, event, data) {
    try {
      const userSockets = this.io.sockets.sockets;
      const userSocketIds = Array.from(userSockets.entries())
        .filter(([_, socket]) => socket.userId === excludeUserId)
        .map(([id]) => id);

      const projectRoom =
        this.roomManager.constructor.getProjectRoom(projectId);

      // Get all sockets in project room except excluded user's sockets
      if (userSocketIds.length > 0) {
        const room = this.io.to(projectRoom);
        userSocketIds.forEach((socketId) => {
          room.except(socketId);
        });
        room.emit(event, data);
      } else {
        // User not connected, emit to everyone
        this.io.to(projectRoom).emit(event, data);
      }

      // console.log(
      //   `📤 Broadcasted '${event}' to project:${projectId} (excluding user:${excludeUserId})`
      // );
      return { success: true, projectId, excludeUserId, event };
    } catch (error) {
      // console.error(`❌ Error broadcasting to project:`, error);
      return { success: false, error: error.message };
    }
  }

  broadcastToWorkspace(workspaceId, excludeUserId, event, data) {
    try {
      const userSockets = this.io.sockets.sockets;
      const userSocketIds = Array.from(userSockets.entries())
        .filter(([_, socket]) => socket.userId === excludeUserId)
        .map(([id]) => id);

      const workspaceRoom =
        this.roomManager.constructor.getWorkspaceRoom(workspaceId);

      if (userSocketIds.length > 0) {
        const room = this.io.to(workspaceRoom);
        userSocketIds.forEach((socketId) => {
          room.except(socketId);
        });
        room.emit(event, data);
      } else {
        this.io.to(workspaceRoom).emit(event, data);
      }

      // console.log(
      //   `📤 Broadcasted '${event}' to workspace:${workspaceId} (excluding user:${excludeUserId})`
      // );
      return { success: true, workspaceId, excludeUserId, event };
    } catch (error) {
      // console.error(`❌ Error broadcasting to workspace:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ==========================================
   * WORKSPACE EVENTS
   * ==========================================
   */

  emitWorkspaceCreated(workspace, createdBy) {
    return this.emitToUsers(createdBy, 'workspace.created', {
      workspace,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceUpdated(workspaceId, workspace, updatedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace.updated', {
      workspace,
      updatedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceDeleted(workspaceId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace.deleted', {
      workspaceId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceMemberAdded(workspaceId, member, addedBy) {
    // Notify the workspace
    this.emitToWorkspace(workspaceId, 'workspace.member.added', {
      member,
      addedBy,
      timestamp: new Date(),
    });

    // Notify the new member personally
    return this.emitToUsers(member.userId, 'workspace.invitation', {
      workspaceId,
      addedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceMemberRemoved(workspaceId, userId, removedBy) {
    // Notify the workspace
    this.emitToWorkspace(workspaceId, 'workspace.member.removed', {
      userId,
      removedBy,
      timestamp: new Date(),
    });

    // Notify the removed member
    return this.emitToUsers(userId, 'workspace.removed', {
      workspaceId,
      removedBy,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * PROJECT EVENTS
   * ==========================================
   */

  emitProjectCreated(workspaceId, project, createdBy) {
    return this.emitToWorkspace(workspaceId, 'project.created', {
      project,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitProjectUpdated(projectId, project, updatedBy) {
    return this.emitToProject(projectId, 'project.updated', {
      project,
      updatedBy,
      timestamp: new Date(),
    });
  }

  emitProjectDeleted(workspaceId, projectId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'project.deleted', {
      projectId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitProjectMemberAdded(projectId, member, addedBy) {
    return this.emitToProject(projectId, 'project.member.added', {
      member,
      addedBy,
      timestamp: new Date(),
    });
  }

  emitProjectMemberRemoved(projectId, userId, removedBy) {
    return this.emitToProject(projectId, 'project.member.removed', {
      userId,
      removedBy,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * TASK EVENTS
   * ==========================================
   */

  emitTaskCreated(projectId, task, createdBy) {
    return this.emitToProject(projectId, 'task.created', {
      task,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitTaskUpdated(projectId, task, userId, changes = {}) {
    return this.emitToProject(projectId, 'task.updated', {
      task,
      updatedBy: userId,
      changes, // e.g., { status: { old: 'todo', new: 'done' } }
      timestamp: new Date(),
    });
  }

  emitTaskDeleted(projectId, taskId, deletedBy) {
    return this.emitToProject(projectId, 'task.deleted', {
      taskId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitTaskAssigned(userId, task, assignedBy) {
    return this.emitToUsers(userId, 'task.assigned', {
      task,
      assignedBy,
      message: `You've been assigned to: ${task.title}`,
      timestamp: new Date(),
    });
  }

  emitTaskStatusChanged(projectId, taskId, oldStatus, newStatus, changedBy) {
    return this.emitToProject(projectId, 'task.status.changed', {
      taskId,
      oldStatus,
      newStatus,
      updatedBy: changedBy,
      timestamp: new Date(),
    });
  }

  emitTaskPriorityChanged(
    projectId,
    taskId,
    oldPriority,
    newPriority,
    changedBy
  ) {
    return this.emitToProject(projectId, 'task.priority.changed', {
      taskId,
      oldPriority,
      newPriority,
      updatedBy: changedBy,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * COMMENT EVENTS
   * ==========================================
   */

  emitCommentAdded(projectId, comment, taskId, addedBy) {
    return this.emitToProject(projectId, 'comment:added', {
      comment,
      taskId,
      addedBy,
      timestamp: new Date(),
    });
  }

  emitCommentUpdated(projectId, comment, taskId, updatedBy) {
    return this.emitToProject(projectId, 'comment:updated', {
      comment,
      taskId,
      updatedBy,
      timestamp: new Date(),
    });
  }

  emitCommentDeleted(projectId, commentId, taskId, deletedBy) {
    return this.emitToProject(projectId, 'comment:deleted', {
      commentId,
      taskId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * USER EVENTS
   * ==========================================
   */

  emitUserProfileUpdated(userId, user) {
    return this.emitToUsers(userId, 'user:profile_updated', {
      user,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * NOTIFICATION EVENTS
   * ==========================================
   */

  emitNotification(userId, notification) {
    return this.emitToUsers(userId, 'notification:new', {
      notification,
      timestamp: new Date(),
    });
  }

  emitNotificationRead(userId, notificationId) {
    return this.emitToUsers(userId, 'notification:read', {
      notificationId,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * PRESENCE EVENTS (Typing, Online/Offline)
   * ==========================================
   */

  emitUserTyping(projectId, userId, taskId = null) {
    return this.broadcastToProject(projectId, userId, 'user:typing', {
      userId,
      taskId,
      timestamp: new Date(),
    });
  }

  emitUserStoppedTyping(projectId, userId, taskId = null) {
    return this.broadcastToProject(projectId, userId, 'user:stopped_typing', {
      userId,
      taskId,
      timestamp: new Date(),
    });
  }

  emitUserPresence(projectId, userId, status) {
    return this.emitToProject(projectId, 'user:presence', {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  emitUserOnline(userId, workspaceIds = []) {
    // Notify user's workspaces
    workspaceIds.forEach((workspaceId) => {
      this.emitToWorkspace(workspaceId, 'user:online', {
        userId,
        timestamp: new Date(),
      });
    });
  }

  emitUserOffline(userId, workspaceIds = []) {
    // Notify user's workspaces
    workspaceIds.forEach((workspaceId) => {
      this.emitToWorkspace(workspaceId, 'user:offline', {
        userId,
        timestamp: new Date(),
      });
    });
  }

  /**
   * ==========================================
   * UTILITY METHODS
   * ==========================================
   */

  isUserOnline(userId) {
    const sockets = this.io.sockets.sockets;
    return Array.from(sockets.values()).some(
      (socket) => socket.userId === userId
    );
  }

  getOnlineUsers() {
    const sockets = this.io.sockets.sockets;
    const userSet = new Set();

    for (const socket of sockets.values()) {
      if (socket.userId) {
        userSet.add(socket.userId);
      }
    }

    return Array.from(userSet);
  }

  getConnectionCount() {
    return this.io.engine.clientsCount;
  }

  getUserSockets(userId) {
    const sockets = this.io.sockets.sockets;
    return new Map(
      Array.from(sockets.entries()).filter(
        ([_, socket]) => socket.userId === userId
      )
    );
  }
}

module.exports = SocketService;
