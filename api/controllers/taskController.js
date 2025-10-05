const Task = require('../models/taskModel');

const catchAsync = require('../utils/catchAsync');

const AppError = require('../utils/appErrors');

exports.getAllTasks = catchAsync(async (req, res, next) => {
  const tasks = await Task.find();
  res.status(200).json({
    status: 'success',
    data: {
      tasks,
    },
  });
});

exports.getTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.id).populate('comments');
  if (!task) {
    return next(new AppError('No task found with this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

exports.createTask = catchAsync(async (req, res, next) => {
  const newTask = await Task.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      task: newTask,
    },
  });
});
