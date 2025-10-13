// controllers/workSpaceController.js
const catchAsync = require('../utils/catchAsync');
const workSpaceService = require('../services/workSpaceService');

exports.getAllWorkSpaces = catchAsync(async (req, res) => {
  const workSpaces = await workSpaceService.getAllWorkSpaces();
  res.status(200).json({ status: 'success', data: workSpaces });
});

exports.getWorkSpace = catchAsync(async (req, res) => {
  const workSpace = await workSpaceService.getWorkSpaceById(
    req.params.workSpaceId
  );

  res.status(200).json({ status: 'success', data: { workSpace } });
});

exports.createWorkSpace = catchAsync(async (req, res) => {
  const workSpace = await workSpaceService.createWorkSpace(
    req.body,
    req.user._id
  );

  res.status(201).json({ status: 'success', data: { workSpace } });
});

exports.updateWorkSpace = catchAsync(async (req, res) => {
  const workSpace = await workSpaceService.updateWorkSpace(
    req.params.workSpaceId,
    req.body
  );

  res.status(200).json({ status: 'success', data: { workSpace } });
});

exports.deleteWorkSpace = catchAsync(async (req, res) => {
  await workSpaceService.deleteWorkSpace(req.params.workSpaceId);
  res.status(204).json({ status: 'success', data: null });
});

exports.getOwnedWorkSpaces = catchAsync(async (req, res) => {
  const owned = await workSpaceService.getOwnedWorkSpaces(req.user._id);

  res.status(200).json({
    status: 'success',
    results: owned.length,
    data: { ownedWorkSpaces: owned },
  });
});

exports.getMemberWorkSpaces = catchAsync(async (req, res) => {
  const member = await workSpaceService.getMemberWorkSpaces(req.user._id);
  res.status(200).json({
    status: 'success',
    results: member.length,
    data: { memberWorkSpaces: member },
  });
});

exports.checkWorkspaceOwnership = catchAsync(async (req, res, next) => {
  req.workSpace = await workSpaceService.checkWorkspaceOwnership(
    req.params.workSpaceId,
    req.user._id
  );

  next();
});

exports.checkworkspaceMembership = catchAsync(async (req, res, next) => {
  req.workSpace = await workSpaceService.checkWorkspaceMembership(
    req.params.workSpaceId,
    req.user._id
  );
  next();
});

exports.getTotalWorkSpaces = catchAsync(async (req, res) => {
  const total = await workSpaceService.getTotalWorkSpaces();
  res.status(200).json({ status: 'success', data: { totalWorkSpaces: total } });
});

exports.getWorkSpacesUsersStats = catchAsync(async (req, res) => {
  const stats = await workSpaceService.getWorkSpacesUsersStats(
    req.params.workSpaceId
  );
  res.status(200).json({
    status: 'success',
    data: { workSpaceId: req.params.workSpaceId, stats },
  });
});

exports.getWorkSpaceUsersActiveStats = catchAsync(async (req, res) => {
  const stats = await workSpaceService.getWorkSpaceUsersActiveStats(
    req.params.workSpaceId
  );
  res.status(200).json({
    status: 'success',
    data: { workSpaceId: req.params.workSpaceId, stats },
  });
});
