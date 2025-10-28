const Joi = require('joi');
const logger = require('../../utils/logger');


function registerTaskHandlers(eventBus, socketService) {
  // Validate required dependencies
  if (!eventBus || typeof eventBus.subscribe !== 'function') {
    throw new Error('Invalid EventBus instance: must implement subscribe()');
  }

  if (!socketService || typeof socketService.emitTaskCreated !== 'function') {
    throw new Error('Invalid SocketService instance: missing required methods');
  }

  // Schema definitions for validation
  const schemas = {
    created: Joi.object({
      task: Joi.object().required(),
      projectId: Joi.string().required(),
      createdBy: Joi.string().required(),
    }),
    updated: Joi.object({
      task: Joi.object().required(),
      projectId: Joi.string().required(),
      updatedBy: Joi.string().required(),
      changes: Joi.object().default({}),
    }),
    deleted: Joi.object({
      taskId: Joi.string().required(),
      projectId: Joi.string().required(),
      deletedBy: Joi.string().required(),
    }),
    assigned: Joi.object({
      userId: Joi.string().required(),
      task: Joi.object().required(),
      assignedBy: Joi.string().required(),
    }),
    statusChanged: Joi.object({
      projectId: Joi.string().required(),
      taskId: Joi.string().required(),
      oldStatus: Joi.string().required(),
      newStatus: Joi.string().required(),
      changedBy: Joi.string().required(),
    }),
  };


  const validate = (schema, payload, eventName) => {
    if (!payload) {
      logger.error(`❌ [${eventName}] Payload is required`);
      return null;
    }

    const { error, value } = schema.validate(payload, {
      allowUnknown: true,
      stripUnknown: true,
      abortEarly: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        message: detail.message,
        path: detail.path.join('.')
      }));
      
      logger.error(`❌ [${eventName}] Invalid payload:`, {
        error: 'Validation failed',
        details: errorDetails,
        payload: JSON.stringify(payload, null, 2)
      });
      return null;
    }

    return value;
  };

  // =============== TASK CREATED ===============
  eventBus.subscribe('task.created', async (payload) => {
    const eventName = 'task.created';
    try {
      const data = validate(schemas.created, payload, eventName);
      if (!data) return;

      const { projectId, task, createdBy } = data;
      const result = await socketService.emitTaskCreated(projectId, task, createdBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit task created event');
      }

      logger.info(`📤 [${eventName}] Successfully emitted for project ${projectId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== TASK UPDATED ===============
  eventBus.subscribe('task.updated', async (payload) => {
    const eventName = 'task.updated';
    try {
      const data = validate(schemas.updated, payload, eventName);
      if (!data) return;

      const { projectId, task, updatedBy, changes } = data;
      const result = await socketService.emitTaskUpdated(projectId, task, updatedBy, changes);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit task updated event');
      }

      logger.info(`📤 [${eventName}] Successfully updated task ${task._id} in project ${projectId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== TASK DELETED ===============
  eventBus.subscribe('task.deleted', async (payload) => {
    const eventName = 'task.deleted';
    try {
      const data = validate(schemas.deleted, payload, eventName);
      if (!data) return;

      const { projectId, taskId, deletedBy } = data;
      const result = await socketService.emitTaskDeleted(projectId, taskId, deletedBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit task deleted event');
      }

      logger.info(`📤 [${eventName}] Successfully deleted task ${taskId} from project ${projectId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== TASK ASSIGNED ===============
  eventBus.subscribe('task.assigned', async (payload) => {
    const eventName = 'task.assigned';
    try {
      const data = validate(schemas.assigned, payload, eventName);
      if (!data) return;

      const { userId, task, assignedBy } = data;
      const result = await socketService.emitTaskAssigned(userId, task, assignedBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit task assigned event');
      }

      logger.info(`📤 [${eventName}] Successfully assigned task ${task._id} to user ${userId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        userId: data?.userId,
        taskId: data?.task?._id
      });
    }
  });

  // =============== TASK STATUS CHANGED ===============
  eventBus.subscribe('task.status.changed', async (payload) => {
    const eventName = 'task.status.changed';
    try {
      const data = validate(schemas.statusChanged, payload, eventName);
      if (!data) return;

      const { projectId, taskId, oldStatus, newStatus, changedBy } = data;
      const result = await socketService.emitTaskStatusChanged(
        projectId,
        taskId,
        oldStatus,
        newStatus,
        changedBy
      );
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit task status changed event');
      }

      logger.info(`📤 [${eventName}] Status changed for task ${taskId} from ${oldStatus} to ${newStatus}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        taskId: data?.taskId,
        projectId: data?.projectId
      });
    }
  });
}

module.exports = { 
  registerTaskHandlers,
  // Export for testing
  _test: {
    schemas: (eventBus, socketService) => {
      const testInstance = {};
      registerTaskHandlers.call(testInstance, eventBus, socketService);
      return testInstance.schemas;
    }
  }
};
