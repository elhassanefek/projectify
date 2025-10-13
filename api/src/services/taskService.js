const TaskRepository = require('../repositories/taskRepository');
const Project = require('../models/projectModel');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

class TaskService {
  // Get all tasks (optionally by project)
  async getAllTasks(projectId) {
    const filter = projectId ? { project: projectId } : {};
    return await TaskRepository.find(filter);
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

    return await TaskRepository.create(data);
  }

  // Update a task
  async updateTask(id, updates) {
    return await TaskRepository.update(id, updates);
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
}

module.exports = new TaskService();
