const Task = require('../models/taskModel');
const Project = require('../models/projectModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all tasks (optionally filtered by project)
exports.getAllTasks = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.params.projectId) filter.project = req.params.projectId;
  const tasks = await Task.find(filter);

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

// Get a single task
exports.getTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.id).populate('comments');
  if (!task) return next(new AppError('No task found with this ID', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

// Create a new task
exports.createTask = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;

  // Ensure the project exists
  const project = await Project.findById(projectId);
  if (!project) return next(new AppError('Project not found', 404));

  // Validate groupId
  const { groupId } = req.body;
  const groupExists = project.groups.some((g) => g.id === groupId);
  if (!groupExists) {
    return next(
      new AppError('Invalid groupId — group not found in project', 400)
    );
  }

  // Set project and creator fields automatically
  req.body.project = projectId;
  req.body.createdBy = req.user._id;
  if (!req.body.groupId && project.groups.length > 0) {
    req.body.groupId = project.groups[0].id; // "To Do"
  }
  const newTask = await Task.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { task: newTask },
  });
});

exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!task) return next(new AppError('Task not found', 404));

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

exports.getTasksByProject = catchAsync(async (req, res, next) => {
  const tasks = await Task.find({ project: req.params.projectId });
  res.status(200).json({
    status: 'success',
    data: { tasks },
  });
});
