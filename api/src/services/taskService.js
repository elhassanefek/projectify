
const TaskRepository = require('../repositories/taskRepository');
const ProjectRepository = require('../repositories/projectRepository');
const Project = require('../models/projectModel');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const eventBus = require('../events/eventBus'); 

class TaskService {
 
  async getAllTasks(projectId, queryParams) {
    const filter = projectId ? { project: projectId } : {};
    return await TaskRepository.findAll(filter, queryParams);
  }

  async checkExistance(id) {
    return await TaskRepository.findById(id);
  }

  async getTaskById(id) {
    return await TaskRepository.findById(id, ['comments']);
  }

  // =============================
  // CREATE TASK
  // =============================
  async createTask({ projectId, userId, ...data }) {
    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);

    // Auto assign default group if missing
    if (!data.groupId && project.groups.length > 0) {
      data.groupId = project.groups[0].id;
    }

    const groupExists = project.groups.some((g) => g.id === data.groupId);
    if (!groupExists) {
      throw new AppError('Invalid groupId — group not found in project', 400);
    }

    data.project = projectId;
    data.createdBy = userId;

    // Create task in database
    const task = await TaskRepository.create(data);

    //  Emit event via eventBus 
    eventBus.emitEvent('task.created', { projectId, task, createdBy: userId });

    // If task is assigned, notify those users individually
    if (data.assignedTo?.length) {
      data.assignedTo.forEach((assignedUserId) => {
        if (assignedUserId.toString() !== userId.toString()) {
          eventBus.emitEvent('task.assigned', {
            userId: assignedUserId,
            task,
            assignedBy: userId,
          });
        }
      });
    }

    console.log(`✅ Task created and event emitted: ${task._id}`);
    return task;
  }

  // =============================
  // UPDATE TASK
  // =============================
  async updateTask(projectId, id, updates, userId) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const existingTask = await TaskRepository.findById(id);
    if (!existingTask) throw new AppError('Task not found', 404);

    const updatedTask = await TaskRepository.update(id, {
      ...updates,
      updatedBy: userId,
    });

    const changes = this._detectChanges(existingTask, updatedTask);

    //  Emit main event
    eventBus.emitEvent('task.updated', {
      projectId,
      task: updatedTask,
      updatedBy: userId,
      changes,
    });

    // Specific sub-events for granularity
    if (changes.status) {
      eventBus.emitEvent('task.status.changed', {
        projectId,
        taskId: id,
        oldStatus: changes.status.old,
        newStatus: changes.status.new,
        updatedBy: userId,
      });
    }

    if (changes.priority) {
      eventBus.emitEvent('task.priority.changed', {
        projectId,
        taskId: id,
        oldPriority: changes.priority.old,
        newPriority: changes.priority.new,
        updatedBy: userId,
      });
    }

    if (changes.assignedTo) {
      const newAssignees = changes.assignedTo.new || [];
      const oldAssignees = changes.assignedTo.old || [];
      const oldIdsSet = new Set(oldAssignees.map((id) => id?.toString()));

      const addedAssignees = newAssignees.filter(
        (newId) => !oldIdsSet.has(newId?.toString())
      );

      addedAssignees.forEach((assignedUserId) => {
        if (assignedUserId?.toString() !== userId?.toString()) {
          eventBus.emitEvent('task.assigned', {
            userId: assignedUserId,
            task: updatedTask,
            assignedBy: userId,
          });
        }
      });
    }

    console.log(`✅ Task updated and event emitted: ${id}`);
    return updatedTask;
  }

  // =============================
  // DELETE TASK
  // =============================
  async deleteTask(projectId, id, userId) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const task = await TaskRepository.findById(id);
    if (!task) throw new AppError('Task not found', 404);

    await TaskRepository.delete(id);

    //  Emit event
    eventBus.emitEvent('task.deleted', { projectId, taskId: id, deletedBy: userId });

    console.log(`✅ Task deleted and event emitted: ${id}`);
    return { success: true, message: 'Task deleted successfully' };
  }

  // =============================
  // ASSIGN TASK
  // =============================
  async assignTask(taskId, userIds, assignedBy) {
    const task = await TaskRepository.findById(taskId);
    if (!task) throw new AppError('Task not found', 404);

    const updatedTask = await TaskRepository.update(taskId, { assignedTo: userIds });

    // Emit per-user assignment events
    userIds.forEach((userId) => {
      if (userId.toString() !== assignedBy.toString()) {
        eventBus.emitEvent('task.assigned', {
          userId,
          task: updatedTask,
          assignedBy,
        });
      }
    });

    // Emit general update event
    eventBus.emitEvent('task.updated', {
      projectId: updatedTask.project.toString(),
      task: updatedTask,
      updatedBy: assignedBy,
      changes: { assignedTo: { old: task.assignedTo, new: userIds } },
    });

    console.log(`✅ Task assigned and events emitted: ${taskId}`);
    return updatedTask;
  }

  // =============================
  // UPDATE STATUS
  // =============================
  async updateTaskStatus(taskId, newStatus, userId) {
    const task = await TaskRepository.findById(taskId);
    if (!task) throw new AppError('Task not found', 404);

    const oldStatus = task.status;
    const updatedTask = await TaskRepository.update(taskId, { status: newStatus });

    eventBus.emitEvent('task.status.changed', {
      projectId: updatedTask.project.toString(),
      taskId,
      oldStatus,
      newStatus,
      updatedBy: userId,
    });

    eventBus.emitEvent('task.updated', {
      projectId: updatedTask.project.toString(),
      task: updatedTask,
      updatedBy: userId,
      changes: { status: { old: oldStatus, new: newStatus } },
    });

    console.log(`✅ Task status updated and events emitted: ${taskId}`);
    return updatedTask;
  }

  // =============================
  // MOVE TO NEW GROUP
  // =============================
  async moveTaskToGroup(taskId, newGroupId, userId) {
    const task = await TaskRepository.findById(taskId);
    if (!task) throw new AppError('Task not found', 404);

    const project = await Project.findById(task.project);
    const groupExists = project.groups.some((g) => g.id === newGroupId);
    if (!groupExists) {
      throw new AppError('Invalid groupId — group not found in project', 400);
    }

    const oldGroupId = task.groupId;
    const updatedTask = await TaskRepository.update(taskId, { groupId: newGroupId });

    eventBus.emitEvent('task.updated', {
      projectId: updatedTask.project.toString(),
      task: updatedTask,
      updatedBy: userId,
      changes: { groupId: { old: oldGroupId, new: newGroupId } },
    });

    console.log(`✅ Task moved and event emitted: ${taskId}`);
    return updatedTask;
  }

  // =============================
  // STATS & AGGREGATIONS
  // =============================
  async getTaskStats(projectId) {
    const total = await TaskRepository.count({ project: projectId });
    const done = await TaskRepository.count({ project: projectId, status: 'done' });
    const inProgress = await TaskRepository.count({
      project: projectId,
      status: 'in-progress',
    });
    const todo = await TaskRepository.count({ project: projectId, status: 'todo' });
    const overdue = await TaskRepository.count({
      project: projectId,
      dueDate: { $lt: new Date() },
      status: { $ne: 'done' },
    });

    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, done, overdue, progress };
  }

  async getTasksByGroup(projectId) {
    const tasksByGroup = await TaskRepository.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);
    return { projectId, tasksByGroup };
  }

  async getTasksByUser(projectId) {
    return await TaskRepository.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: { path: '$assignedTo', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$assignedTo',
          totalTasks: { $sum: 1 },
          completeTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
          },
          toDoTasks: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          userName: '$user.name',
          totalTasks: 1,
          completeTasks: 1,
          inProgressTasks: 1,
          toDoTasks: 1,
        },
      },
    ]);
  }

  // =============================
  // PRIVATE HELPERS
  // =============================
  _detectChanges(oldTask, newTask) {
    const changes = {};
    const fieldsToCheck = [
      'title',
      'description',
      'status',
      'priority',
      'assignedTo',
      'dueDate',
      'groupId',
    ];

    fieldsToCheck.forEach((field) => {
      const oldValue = oldTask[field];
      const newValue = newTask[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[field] = { old: oldValue, new: newValue };
      }
    });

    return changes;
  }
}

module.exports = new TaskService();
