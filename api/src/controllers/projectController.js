const catchAsync = require('../utils/catchAsync');
const projectService = require('../services/projectService');

exports.getAllProjects = catchAsync(async (req, res, next) => {
  const projects = await projectService.getAllProjects(
    req.params.workSpaceId,
    req.query
  );

  res.status(200).json({ status: 'success', data: { projects } });
});

exports.createProject = catchAsync(async (req, res, next) => {
  if (!req.body.workSpace) req.body.workSpace = req.params.workSpaceId;

  const project = await projectService.createProject(req.body, req.user._id);
  res.status(201).json({ status: 'success', data: { project } });
});

exports.getProject = catchAsync(async (req, res, next) => {
  const project = await projectService.getProjectById(req.params.id);
  res.status(200).json({ status: 'success', data: { project } });
});

exports.updateProject = catchAsync(async (req, res, next) => {
  const project = await projectService.updateProject(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: { project } });
});

exports.deleteProject = catchAsync(async (req, res, next) => {
  await projectService.deleteProject(req.params.id);
  res.status(204).json({ status: 'success', data: null });
});
exports.checkProjectOwnership = catchAsync(async (req, res, next) => {
  req.project = await projectService.checkProjectOwnership(
    req.params.id,
    req.user._id
  );
  next();
});
