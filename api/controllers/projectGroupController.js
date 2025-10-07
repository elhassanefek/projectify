const Project = require('../models/projectModel');
const AppError = require('../utils/appError');

const catchAsync = require('../utils/catchAsync');

//add new group

exports.addGroup = catchAsync(async (req, res, next) => {
  const { projrctId } = req.params;

  const { title, color, position } = req.body;

  const project = await Project.findById(projrctId);
  if (!project) {
    return next(new AppError('No project found with this ID', 404));
  }

  const newGroup = {
    id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    color: color || '#0073ea',
    collapsed: false,
    position: position ?? project.groups.length,
  };
  project.groups.push(newGroup);
  await project.save();
  res.status(201).json({
    status: 'success',
    data: { group: newGroup },
  });
});

exports.updateGroup = catchAsync(async (req, res, next) => {
  const { projectId, groupId } = req.params;

  const project = await Project.findById(projectId);

  if (!project) {
    return next(new AppError('No project found with this ID', 404));
  }
  const group = project.groups.find((g) => g.id === groupId);
  if (!group) {
    return next(new AppError('No group found with this ID', 404));
  }
  Object.assign(group, req.body);
  await project.save();
  res.status(200).json({ status: 'success', data: { group } });
});
exports.deleteGroup = catchAsync(async (req, res, next) => {
  const { projectId, groupId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) return next(new AppError('Project not found', 404));

  project.groups = project.groups.filter((g) => g.id !== groupId);
  await project.save();

  res.status(204).json({ status: 'success', data: null });
});
