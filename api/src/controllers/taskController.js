const TaskService = require('../services/taskService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ------------------ Get all tasks ------------------
exports.getAllTasks = catchAsync(async (req, res, next) => {
  const tasks = await TaskService.getAllTasks(req.params.projectId, req.query);

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

// ------------------ Get single task ------------------
exports.getTask = catchAsync(async (req, res, next) => {
  const task = await TaskService.getTaskById(req.params.id);

  if (!task) return next(new AppError('No task found with this ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// ------------------ Create new task ------------------
exports.createTask = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;
  const userId = req.user._id;

  const newTask = await TaskService.createTask({
    ...req.body,
    projectId,
    userId,
  });

  res.status(201).json({
    status: 'success',
    data: { task: newTask },
  });
});

// ------------------ Update task ------------------
exports.updateTask = catchAsync(async (req, res, next) => {
  const updatedTask = await TaskService.updateTask(req.params.id, req.body);

  if (!updatedTask) return next(new AppError('Task not found', 404));

  res.status(200).json({
    status: 'success',
    data: { task: updatedTask },
  });
});

// ------------------ Get tasks by project ------------------
exports.getTasksByProject = catchAsync(async (req, res, next) => {
  const tasks = await TaskService.getTasksByProject(req.params.projectId);

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

// ------------------ Task statistics ------------------
exports.getTaskStats = catchAsync(async (req, res, next) => {
  const stats = await TaskService.getTaskStats(req.params.projectId);

  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

// ------------------ Tasks grouped by groupId ------------------
exports.getTasksByGroup = catchAsync(async (req, res, next) => {
  const result = await TaskService.getTasksByGroup(req.params.projectId);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

// ------------------ Tasks grouped by user ------------------
exports.getTasksByUser = catchAsync(async (req, res, next) => {
  const result = await TaskService.getTasksByUser(req.params.projectId);

  res.status(200).json({
    status: 'success',
    results: result.length,
    data: { tasksByUser: result },
  });
});
