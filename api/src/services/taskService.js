const TaskRepository = require('../repositories/taskRepository');
const Project = require('../models/projectModel');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const socketService = require('./socketService');
const ProjectReposiotry = require('../repositories/projectRepository');
class TaskService {
  // Get all tasks (optionally by project)
  async getAllTasks(projectId, queryParams) {
    const filter = projectId ? { project: projectId } : {};
    return await TaskRepository.findAll(filter, queryParams);
  }

  async checkExistance(id) {
    return await TaskRepository.findById(id);
  }

  // Get single task
  async getTaskById(id) {
    return await TaskRepository.findById(id, ['comments']);
  }

  // Create new task
  async createTask({ projectId, userId, ...data }) {
    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);

    // If no groupId provided but project has groups, assign first group
    if (!data.groupId && project.groups.length > 0) {
      data.groupId = project.groups[0].id; // default to "To Do"
    }

    const groupExists = project.groups.some((g) => g.id === data.groupId);
    if (!groupExists) {
      throw new AppError('Invalid groupId — group not found in project', 400);
    }

    data.project = projectId;
    data.createdBy = userId;

    // Create task in database
    const task = await TaskRepository.create(data);

    // Emit socket event to all project members
    socketService.emitTaskCreated(projectId, task, userId);

    // If task is assigned to someone, notify them personally
    if (data.assignedTo && data.assignedTo.length > 0) {
      data.assignedTo.forEach((assignedUserId) => {
        // Only notify if assigned to someone else
        if (assignedUserId.toString() !== userId.toString()) {
          socketService.emitTaskAssigned(assignedUserId, task, userId);
        }
      });
    }

    console.log(`✅ Task created and emitted: ${task._id}`);
    return task;
  }

  // Update a task
  async updateTask(projectId, id, updates, userId) {
    //check if the project exist
    const project = await ProjectReposiotry.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    // Get the existing task to detect changes
    const existingTask = await TaskRepository.findById(id);
    if (!existingTask) {
      throw new AppError('Task not found', 404);
    }

    // Update the task

    const updatedTask = await TaskRepository.update(id, {
      ...updates,
      updatedBy: userId,
    });

    //  Detect changes
    const changes = this._detectChanges(existingTask, updatedTask);

    //  Emit task updated event to project
    socketService.emitTaskUpdated(
      updatedTask.project.toString(),
      updatedTask,
      userId,
      changes
    );

    // If status changed, emit specific status change event
    if (changes.status) {
      socketService.emitTaskStatusChanged(
        updatedTask.project.toString(),
        id,
        changes.status.old,
        changes.status.new,
        userId
      );
    }

    //  If priority changed, emit priority change event
    if (changes.priority) {
      socketService.emitTaskPriorityChanged(
        updatedTask.project.toString(),
        id,
        changes.priority.old,
        changes.priority.new,
        userId
      );
    }

    //  If assignee changed, notify the new assignees
    if (changes.assignedTo) {
      const newAssignees = changes.assignedTo.new || [];
      const oldAssignees = changes.assignedTo.old || [];

      const oldIdsSet = new Set(
        oldAssignees
          .filter((id) => id != null) // Remove null/undefined
          .map((id) => id.toString())
      );

      const addedAssignees = newAssignees
        .filter((id) => id != null) // Remove null/undefined
        .filter((newId) => !oldIdsSet.has(newId.toString()));

      // Notify newly assigned users
      addedAssignees.forEach((assignedUserId) => {
        if (assignedUserId?.toString() !== userId?.toString()) {
          socketService.emitTaskAssigned(assignedUserId, updatedTask, userId);
        }
      });
    }

    console.log(`✅ Task updated and emitted: ${id}`);
    return updatedTask;
  }

  // Delete a task
  async deleteTask(projectId, id, userId) {
    const project = await ProjectReposiotry.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    const task = await TaskRepository.findById(id);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Delete the task
    await TaskRepository.delete(id);

    // Emit task deleted event
    socketService.emitTaskDeleted(projectId, id, userId);

    console.log(`✅ Task deleted and emitted: ${id}`);
    return { success: true, message: 'Task deleted successfully' };
  }

  // Assign task to users
  async assignTask(taskId, userIds, assignedBy) {
    const task = await TaskRepository.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Update assignedTo field
    const updatedTask = await TaskRepository.update(taskId, {
      assignedTo: userIds,
    });

    //  Notify each assigned user
    userIds.forEach((userId) => {
      if (userId.toString() !== assignedBy.toString()) {
        socketService.emitTaskAssigned(userId, updatedTask, assignedBy);
      }
    });

    //  Emit update to project
    socketService.emitTaskUpdated(
      updatedTask.project.toString(),
      updatedTask,
      assignedBy,
      { assignedTo: { old: task.assignedTo, new: userIds } }
    );

    console.log(`✅ Task assigned and emitted: ${taskId}`);
    return updatedTask;
  }

  // Update task status
  async updateTaskStatus(taskId, newStatus, userId) {
    const task = await TaskRepository.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const oldStatus = task.status;

    // Update status
    const updatedTask = await TaskRepository.update(taskId, {
      status: newStatus,
    });

    //  Emit status change event
    socketService.emitTaskStatusChanged(
      updatedTask.project.toString(),
      taskId,
      oldStatus,
      newStatus,
      userId
    );

    //  Also emit general update
    socketService.emitTaskUpdated(
      updatedTask.project.toString(),
      updatedTask,
      userId,
      { status: { old: oldStatus, new: newStatus } }
    );

    console.log(`✅ Task status updated and emitted: ${taskId}`);
    return updatedTask;
  }

  // Move task to different group
  async moveTaskToGroup(taskId, newGroupId, userId) {
    const task = await TaskRepository.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Verify group exists in project
    const project = await Project.findById(task.project);
    const groupExists = project.groups.some((g) => g.id === newGroupId);
    if (!groupExists) {
      throw new AppError('Invalid groupId — group not found in project', 400);
    }

    const oldGroupId = task.groupId;

    // Update group
    const updatedTask = await TaskRepository.update(taskId, {
      groupId: newGroupId,
    });

    // Emit task updated event
    socketService.emitTaskUpdated(
      updatedTask.project.toString(),
      updatedTask,
      userId,
      { groupId: { old: oldGroupId, new: newGroupId } }
    );

    console.log(`✅ Task moved to new group and emitted: ${taskId}`);
    return updatedTask;
  }

  // Get all tasks in a project
  async getTasksByProject(projectId) {
    return await TaskRepository.find({ project: projectId });
  }

  // Get general task stats
  async getTaskStats(projectId) {
    const total = await TaskRepository.count({ project: projectId });
    const done = await TaskRepository.count({
      project: projectId,
      status: 'done',
    });
    const inProgress = await TaskRepository.count({
      project: projectId,
      status: 'in-progress',
    });
    const todo = await TaskRepository.count({
      project: projectId,
      status: 'todo',
    });
    const overdue = await TaskRepository.count({
      project: projectId,
      dueDate: { $lt: new Date() },
      status: { $ne: 'done' },
    });

    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, todo, inProgress, done, overdue, progress };
  }

  // Aggregate tasks by group
  async getTasksByGroup(projectId) {
    const tasksByGroup = await TaskRepository.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);

    return { projectId, tasksByGroup };
  }

  // Aggregate tasks by assigned user
  async getTasksByUser(projectId) {
    return await TaskRepository.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $unwind: { path: '$assignedTo', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$assignedTo',
          totalTasks: { $sum: 1 },
          completeTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] },
          },
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

  //helper methods
  /**
   * Detect changes between old and new task
   * Returns object like: { status: { old: 'todo', new: 'done' }, ... }
   */
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

      // Compare values (handles objects/arrays via JSON)
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[field] = {
          old: oldValue,
          new: newValue,
        };
      }
    });

    return changes;
  }
}

module.exports = new TaskService();
