const socketConfig = require('../config/socket');

class SocketService {
  emitToUsers(userIds, event, data) {
    try {
      const io = socketConfig.getIO();
      const users = Array.isArray(userIds) ? userIds : [userIds];

      users.forEach((userId) => {
        io.to(`user:${userId}`).emit(event, data);
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
      const io = socketConfig.getIO();
      io.to(`workspace:${workspaceId}`).emit(event, data);

      // console.log(`📤 Emitted '${event}' to workspace:${workspaceId}`);
      return { success: true, workspaceId, event };
    } catch (error) {
      // console.error(`❌ Error emitting to workspace:`, error);
      return { success: false, error: error.message };
    }
  }

  emitToProject(projectId, event, data) {
    try {
      const io = socketConfig.getIO();
      io.to(`project:${projectId}`).emit(event, data);

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
      const io = socketConfig.getIO();
      io.emit(event, data);

      // console.log(`📤 Emitted '${event}' to all clients`);
      return { success: true, event };
    } catch (error) {
      // console.error(`❌ Error emitting to all:`, error);
      return { success: false, error: error.message };
    }
  }

  broadcastToProject(projectId, excludeUserId, event, data) {
    try {
      const io = socketConfig.getIO();
      const userSockets = socketConfig.getUserSockets(excludeUserId);

      // Get all sockets in project room except excluded user's sockets
      if (userSockets.size > 0) {
        const room = io.to(`project:${projectId}`);
        userSockets.forEach((socketId) => {
          room.except(socketId);
        });
        room.emit(event, data);
      } else {
        // User not connected, emit to everyone
        io.to(`project:${projectId}`).emit(event, data);
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
      const io = socketConfig.getIO();
      const userSockets = socketConfig.getUserSockets(excludeUserId);

      if (userSockets.size > 0) {
        const room = io.to(`workspace:${workspaceId}`);
        userSockets.forEach((socketId) => {
          room.except(socketId);
        });
        room.emit(event, data);
      } else {
        io.to(`workspace:${workspaceId}`).emit(event, data);
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
    return this.emitToUsers(createdBy, 'workspace:created', {
      workspace,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceUpdated(workspaceId, workspace, updatedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace:updated', {
      workspace,
      updatedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceDeleted(workspaceId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace:deleted', {
      workspaceId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceMemberAdded(workspaceId, member, addedBy) {
    // Notify the workspace
    this.emitToWorkspace(workspaceId, 'workspace:member_added', {
      member,
      addedBy,
      timestamp: new Date(),
    });

    // Notify the new member personally
    return this.emitToUsers(member.userId, 'workspace:invitation', {
      workspaceId,
      addedBy,
      timestamp: new Date(),
    });
  }

  emitWorkspaceMemberRemoved(workspaceId, userId, removedBy) {
    // Notify the workspace
    this.emitToWorkspace(workspaceId, 'workspace:member_removed', {
      userId,
      removedBy,
      timestamp: new Date(),
    });

    // Notify the removed member
    return this.emitToUsers(userId, 'workspace:removed', {
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
    return this.emitToWorkspace(workspaceId, 'project:created', {
      project,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitProjectUpdated(projectId, project, updatedBy) {
    return this.emitToProject(projectId, 'project:updated', {
      project,
      updatedBy,
      timestamp: new Date(),
    });
  }

  emitProjectDeleted(workspaceId, projectId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'project:deleted', {
      projectId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitProjectMemberAdded(projectId, member, addedBy) {
    return this.emitToProject(projectId, 'project:member_added', {
      member,
      addedBy,
      timestamp: new Date(),
    });
  }

  emitProjectMemberRemoved(projectId, userId, removedBy) {
    return this.emitToProject(projectId, 'project:member_removed', {
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
    return this.emitToProject(projectId, 'task:created', {
      task,
      createdBy,
      timestamp: new Date(),
    });
  }

  emitTaskUpdated(projectId, task, userId, changes = {}) {
    return this.emitToProject(projectId, 'task:updated', {
      task,
      updatedBy: userId,
      changes, // e.g., { status: { old: 'todo', new: 'done' } }
      timestamp: new Date(),
    });
  }

  emitTaskDeleted(projectId, taskId, deletedBy) {
    return this.emitToProject(projectId, 'task:deleted', {
      taskId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  emitTaskAssigned(userId, task, assignedBy) {
    return this.emitToUsers(userId, 'task:assigned', {
      task,
      assignedBy,
      message: `You've been assigned to: ${task.title}`,
      timestamp: new Date(),
    });
  }

  emitTaskStatusChanged(projectId, taskId, oldStatus, newStatus, changedBy) {
    return this.emitToProject(projectId, 'task:status_changed', {
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
    return this.emitToProject(projectId, 'task:priority_changed', {
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
    return socketConfig.isUserOnline(userId);
  }

  getOnlineUsers() {
    return socketConfig.getOnlineUsers();
  }

  getConnectionCount() {
    return socketConfig.getConnectionCount();
  }

  getUserSockets(userId) {
    return socketConfig.getUserSockets(userId);
  }
}

module.exports = new SocketService();
