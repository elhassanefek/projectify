const Project = require('../models/projectModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('./../utils/appErrors');

exports.getAllProjects = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.params.workSpaceId) filter = { workSpace: req.params.workSpaceId };
  const projects = await Project.find(filter);
  res.status(200).json({
    status: 'success',
    data: projects,
  });
});

exports.createProject = catchAsync(async (req, res, next) => {
  //Allow nested routes
  if (!req.body.workSpace) req.body.workSpace = req.params.workSpaceId;
  if (!req.body.user) req.body.user = req.user.id;
  const newProject = await Project.create(req.body);
  res.status(201).json({
    status: 'success',
    data: {
      project: newProject,
    },
  });
});

exports.getProject = catchAsync(async (req, res, next) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    return next(new AppError('No project found with this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: { project },
  });
});

exports.deleteProject = catchAsync(async (req, res, next) => {
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) {
    return next(new AppError('No projct found with this ID', 404));
  }
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.updateProject = catchAsync(async (req, res, next) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!project) {
    return next(new AppError('No project found with this ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});
