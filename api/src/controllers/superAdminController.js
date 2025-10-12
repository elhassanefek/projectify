const User = require('../models/userModel');
const WorkSpace = require('../models/workSpaceModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all users in the SaaS (only super-admin can access)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users },
  });
});

// Get all workspaces in the SaaS
exports.getAllWorkspaces = catchAsync(async (req, res, next) => {
  const workspaces = await WorkSpace.find();

  res.status(200).json({
    status: 'success',
    results: workspaces.length,
    data: { workspaces },
  });
});
