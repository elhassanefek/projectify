const socketConfig = require('../config/socket');

class SocketService {
  /**
   * Emit event to specific user(s)
   * Use for: Personal notifications, direct messages
   * @param {String|Array} userIds - Single userId or array of userIds
   * @param {String} event - Event name (e.g., 'notification:new')
   * @param {Object} data - Data to send
   */
  emitToUsers(userIds, event, data) {
    try {
      const io = socketConfig.getIO();
      const users = Array.isArray(userIds) ? userIds : [userIds];

      users.forEach((userId) => {
        io.to(`user:${userId}`).emit(event, data);
      });

      console.log(`📤 Emitted '${event}' to ${users.length} user(s)`);
      return { success: true, userIds: users, event };
    } catch (error) {
      console.error(`❌ Error emitting to users:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit event to a workspace room
   * Use for: Workspace-level updates
   * @param {String} workspaceId - Workspace ID
   * @param {String} event - Event name
   * @param {Object} data - Data to send
   */
  emitToWorkspace(workspaceId, event, data) {
    try {
      const io = socketConfig.getIO();
      io.to(`workspace:${workspaceId}`).emit(event, data);

      console.log(`📤 Emitted '${event}' to workspace:${workspaceId}`);
      return { success: true, workspaceId, event };
    } catch (error) {
      console.error(`❌ Error emitting to workspace:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit event to a project room
   * Use for: Project-level updates, task changes
   * @param {String} projectId - Project ID
   * @param {String} event - Event name
   * @param {Object} data - Data to send
   */
  emitToProject(projectId, event, data) {
    try {
      const io = socketConfig.getIO();
      io.to(`project:${projectId}`).emit(event, data);

      console.log(`📤 Emitted '${event}' to project:${projectId}`);
      return { success: true, projectId, event };
    } catch (error) {
      console.error(`❌ Error emitting to project:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit event to all connected clients
   * Use sparingly: System-wide announcements only
   * @param {String} event - Event name
   * @param {Object} data - Data to send
   */
  emitToAll(event, data) {
    try {
      const io = socketConfig.getIO();
      io.emit(event, data);

      console.log(`📤 Emitted '${event}' to all clients`);
      return { success: true, event };
    } catch (error) {
      console.error(`❌ Error emitting to all:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast to project but exclude the user who triggered the action
   * Use for: Avoiding echo - user already knows what they did
   * @param {String} projectId - Project ID
   * @param {String} excludeUserId - User ID to exclude
   * @param {String} event - Event name
   * @param {Object} data - Data to send
   */
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

      console.log(
        `📤 Broadcasted '${event}' to project:${projectId} (excluding user:${excludeUserId})`
      );
      return { success: true, projectId, excludeUserId, event };
    } catch (error) {
      console.error(`❌ Error broadcasting to project:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast to workspace excluding specific user
   * @param {String} workspaceId - Workspace ID
   * @param {String} excludeUserId - User ID to exclude
   * @param {String} event - Event name
   * @param {Object} data - Data to send
   */
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

      console.log(
        `📤 Broadcasted '${event}' to workspace:${workspaceId} (excluding user:${excludeUserId})`
      );
      return { success: true, workspaceId, excludeUserId, event };
    } catch (error) {
      console.error(`❌ Error broadcasting to workspace:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ==========================================
   * WORKSPACE EVENTS
   * ==========================================
   */

  /**
   * Emit workspace created event
   * @param {Object} workspace - Workspace object
   * @param {String} createdBy - User ID who created it
   */
  emitWorkspaceCreated(workspace, createdBy) {
    return this.emitToUsers(createdBy, 'workspace:created', {
      workspace,
      createdBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit workspace updated event
   * @param {String} workspaceId - Workspace ID
   * @param {Object} workspace - Updated workspace object
   * @param {String} updatedBy - User ID who updated it
   */
  emitWorkspaceUpdated(workspaceId, workspace, updatedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace:updated', {
      workspace,
      updatedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit workspace deleted event
   * @param {String} workspaceId - Workspace ID
   * @param {String} deletedBy - User ID who deleted it
   */
  emitWorkspaceDeleted(workspaceId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'workspace:deleted', {
      workspaceId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit workspace member added event
   * @param {String} workspaceId - Workspace ID
   * @param {Object} member - Member object
   * @param {String} addedBy - User ID who added the member
   */
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

  /**
   * Emit workspace member removed event
   * @param {String} workspaceId - Workspace ID
   * @param {String} userId - User ID who was removed
   * @param {String} removedBy - User ID who removed them
   */
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

  /**
   * Emit project created event
   * @param {String} workspaceId - Workspace ID
   * @param {Object} project - Project object
   * @param {String} createdBy - User ID who created it
   */
  emitProjectCreated(workspaceId, project, createdBy) {
    return this.emitToWorkspace(workspaceId, 'project:created', {
      project,
      createdBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit project updated event
   * @param {String} projectId - Project ID
   * @param {Object} project - Updated project object
   * @param {String} updatedBy - User ID who updated it
   */
  emitProjectUpdated(projectId, project, updatedBy) {
    return this.emitToProject(projectId, 'project:updated', {
      project,
      updatedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit project deleted event
   * @param {String} workspaceId - Workspace ID
   * @param {String} projectId - Project ID
   * @param {String} deletedBy - User ID who deleted it
   */
  emitProjectDeleted(workspaceId, projectId, deletedBy) {
    return this.emitToWorkspace(workspaceId, 'project:deleted', {
      projectId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit project member added event
   * @param {String} projectId - Project ID
   * @param {Object} member - Member object
   * @param {String} addedBy - User ID who added the member
   */
  emitProjectMemberAdded(projectId, member, addedBy) {
    return this.emitToProject(projectId, 'project:member_added', {
      member,
      addedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit project member removed event
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID who was removed
   * @param {String} removedBy - User ID who removed them
   */
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

  /**
   * Emit task created event
   * @param {String} projectId - Project ID
   * @param {Object} task - Task object
   * @param {String} createdBy - User ID who created it
   */
  emitTaskCreated(projectId, task, createdBy) {
    return this.emitToProject(projectId, 'task:created', {
      task,
      createdBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit task updated event
   * @param {String} projectId - Project ID
   * @param {Object} task - Updated task object
   * @param {String} updatedBy - User ID who updated it
   * @param {Object} changes - Object showing what changed
   */
  emitTaskUpdated(projectId, task, updatedBy, changes = {}) {
    return this.emitToProject(projectId, 'task:updated', {
      task,
      updatedBy,
      changes, // e.g., { status: { old: 'todo', new: 'done' } }
      timestamp: new Date(),
    });
  }

  /**
   * Emit task deleted event
   * @param {String} projectId - Project ID
   * @param {String} taskId - Task ID
   * @param {String} deletedBy - User ID who deleted it
   */
  emitTaskDeleted(projectId, taskId, deletedBy) {
    return this.emitToProject(projectId, 'task:deleted', {
      taskId,
      deletedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit task assigned event (personal notification)
   * @param {String} userId - User ID who was assigned
   * @param {Object} task - Task object
   * @param {String} assignedBy - User ID who assigned it
   */
  emitTaskAssigned(userId, task, assignedBy) {
    return this.emitToUsers(userId, 'task:assigned', {
      task,
      assignedBy,
      message: `You've been assigned to: ${task.title}`,
      timestamp: new Date(),
    });
  }

  /**
   * Emit task status changed event
   * @param {String} projectId - Project ID
   * @param {String} taskId - Task ID
   * @param {String} oldStatus - Previous status
   * @param {String} newStatus - New status
   * @param {String} changedBy - User ID who changed it
   */
  emitTaskStatusChanged(projectId, taskId, oldStatus, newStatus, changedBy) {
    return this.emitToProject(projectId, 'task:status_changed', {
      taskId,
      oldStatus,
      newStatus,
      changedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit task priority changed event
   * @param {String} projectId - Project ID
   * @param {String} taskId - Task ID
   * @param {String} oldPriority - Previous priority
   * @param {String} newPriority - New priority
   * @param {String} changedBy - User ID who changed it
   */
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
      changedBy,
      timestamp: new Date(),
    });
  }

  /**
   * ==========================================
   * COMMENT EVENTS
   * ==========================================
   */

  /**
   * Emit comment added event
   * @param {String} projectId - Project ID
   * @param {Object} comment - Comment object
   * @param {String} taskId - Task ID
   * @param {String} addedBy - User ID who added the comment
   */
  emitCommentAdded(projectId, comment, taskId, addedBy) {
    return this.emitToProject(projectId, 'comment:added', {
      comment,
      taskId,
      addedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit comment updated event
   * @param {String} projectId - Project ID
   * @param {Object} comment - Updated comment object
   * @param {String} taskId - Task ID
   * @param {String} updatedBy - User ID who updated the comment
   */
  emitCommentUpdated(projectId, comment, taskId, updatedBy) {
    return this.emitToProject(projectId, 'comment:updated', {
      comment,
      taskId,
      updatedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Emit comment deleted event
   * @param {String} projectId - Project ID
   * @param {String} commentId - Comment ID
   * @param {String} taskId - Task ID
   * @param {String} deletedBy - User ID who deleted the comment
   */
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

  /**
   * Emit user profile updated event
   * @param {String} userId - User ID
   * @param {Object} user - Updated user object
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

  /**
   * Emit new notification event
   * @param {String} userId - User ID to notify
   * @param {Object} notification - Notification object
   */
  emitNotification(userId, notification) {
    return this.emitToUsers(userId, 'notification:new', {
      notification,
      timestamp: new Date(),
    });
  }

  /**
   * Emit notification read event
   * @param {String} userId - User ID
   * @param {String} notificationId - Notification ID
   */
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

  /**
   * Emit user typing event
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID who is typing
   * @param {String} taskId - Optional: Task ID they're typing in
   */
  emitUserTyping(projectId, userId, taskId = null) {
    return this.broadcastToProject(projectId, userId, 'user:typing', {
      userId,
      taskId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit user stopped typing event
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID who stopped typing
   * @param {String} taskId - Optional: Task ID
   */
  emitUserStoppedTyping(projectId, userId, taskId = null) {
    return this.broadcastToProject(projectId, userId, 'user:stopped_typing', {
      userId,
      taskId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit user presence event
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID
   * @param {String} status - Status: 'online', 'offline', 'away', 'busy'
   */
  emitUserPresence(projectId, userId, status) {
    return this.emitToProject(projectId, 'user:presence', {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Emit user online event
   * @param {String} userId - User ID
   * @param {Array} workspaceIds - Array of workspace IDs user has access to
   */
  emitUserOnline(userId, workspaceIds = []) {
    // Notify user's workspaces
    workspaceIds.forEach((workspaceId) => {
      this.emitToWorkspace(workspaceId, 'user:online', {
        userId,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Emit user offline event
   * @param {String} userId - User ID
   * @param {Array} workspaceIds - Array of workspace IDs user has access to
   */
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

  /**
   * Check if a user is currently online
   * @param {String} userId - User ID to check
   * @returns {Boolean}
   */
  isUserOnline(userId) {
    return socketConfig.isUserOnline(userId);
  }

  /**
   * Get all currently online users
   * @returns {Array} Array of user IDs
   */
  getOnlineUsers() {
    return socketConfig.getOnlineUsers();
  }

  /**
   * Get total number of socket connections
   * @returns {Number}
   */
  getConnectionCount() {
    return socketConfig.getConnectionCount();
  }

  /**
   * Get all socket IDs for a specific user
   * @param {String} userId - User ID
   * @returns {Set} Set of socket IDs
   */
  getUserSockets(userId) {
    return socketConfig.getUserSockets(userId);
  }
}

// Export singleton instance
module.exports = new SocketService();
