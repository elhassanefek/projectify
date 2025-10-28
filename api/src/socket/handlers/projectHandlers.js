const Joi = require('joi');
const logger = require('../../utils/logger');

function registerProjectHandlers(eventBus, socketService) {
  // Validate required dependencies
  if (!eventBus || typeof eventBus.subscribe !== 'function') {
    throw new Error('Invalid EventBus instance: must implement subscribe()');
  }

  if (!socketService || typeof socketService.emitProjectCreated !== 'function') {
    throw new Error('Invalid SocketService instance: missing required methods');
  }

  // Schema definitions for validation
  const schemas = {
    created: Joi.object({
      project: Joi.object().required(),
      workSpaceId: Joi.string().required(),
      createdBy: Joi.string().required(),
    }),
    updated: Joi.object({
      project: Joi.object().required(),
      workSpaceId: Joi.string().required(),
      updatedBy: Joi.string().required(),
      changes: Joi.object().default({}),
    }),
    deleted: Joi.object({
      projectId: Joi.string().required(),
      workSpaceId: Joi.string().required(),
      deletedBy: Joi.string().required(),
    }),
    memberAdded: Joi.object({
      userId: Joi.string().required(),
      project: Joi.object().required(),
      addedBy: Joi.string().required(),
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

  // =============== PROJECT CREATED ===============
  eventBus.subscribe('project.created', async (payload) => {
    const eventName = 'project.created';
    try {
      const data = validate(schemas.created, payload, eventName);
      if (!data) return;

      const { workSpaceId, project, createdBy } = data;
      const result = await socketService.emitProjectCreated(workSpaceId, project, createdBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit project created event');
      }

      logger.info(`📤 [${eventName}] Successfully emitted for workspace ${workSpaceId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== PROJECT UPDATED ===============
  eventBus.subscribe('project.updated', async (payload) => {
    const eventName = 'project.updated';
    try {
      const data = validate(schemas.updated, payload, eventName);
      if (!data) return;

      const { workSpaceId, project, updatedBy, changes } = data;
      const result = await socketService.emitProjectUpdated(workSpaceId, project, updatedBy, changes);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit project updated event');
      }

      logger.info(`📤 [${eventName}] Successfully emitted for project ${project._id}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== PROJECT DELETED ===============
  eventBus.subscribe('project.deleted', async (payload) => {
    const eventName = 'project.deleted';
    try {
      const data = validate(schemas.deleted, payload, eventName);
      if (!data) return;

      const { workSpaceId, projectId, deletedBy } = data;
      const result = await socketService.emitProjectDeleted(workSpaceId, projectId, deletedBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit project deleted event');
      }

      logger.info(`📤 [${eventName}] Successfully emitted for project ${projectId}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  // =============== PROJECT MEMBER ADDED ===============
  eventBus.subscribe('project.member.added', async (payload) => {
    const eventName = 'project.member.added';
    try {
      const data = validate(schemas.memberAdded, payload, eventName);
      if (!data) return;

      const { userId, project, addedBy } = data;
      const result = await socketService.emitProjectMemberAdded(userId, project, addedBy);
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to emit project member added event');
      }

      logger.info(`📤 [${eventName}] Successfully emitted for user ${userId} to project ${project._id}`);
    } catch (error) {
      logger.error(`❌ [${eventName}] Failed to handle: ${error.message}`, {
        error: error.stack,
        payload
      });
    }
  });

  logger.info('✅ Project event handlers registered successfully');
}

module.exports = { 
  registerProjectHandlers,
  // Export for testing
  _test: {
    schemas: (eventBus, socketService) => ({
      ...schemas,
      validate: (schema, payload, eventName) => 
        validate(schemas[schema], payload, eventName)
    })
  }
};