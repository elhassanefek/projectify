const WorkSpace = require('../models/workSpaceModel');
const User = require('../models/userModel');

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

//............................CRUD OPS for the workSpaces........................................//
exports.getAllWorkSpaces = catchAsync(async (req, res) => {
  const workSpaces = await WorkSpace.find();

  res.status(200).json({
    status: 'success',
    data: workSpaces,
  });
});

exports.getWorkSpace = catchAsync(async (req, res, next) => {
  const workSpace = await WorkSpace.findById(req.params.id).populate({
    path: 'createdBy',
    select: 'name',
  });

  if (!workSpace) {
    return next(new AppError('No workSpace found with this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      workSpace,
    },
  });
});

exports.createWorkSpace = catchAsync(async (req, res, next) => {
  const newWorkSpace = await WorkSpace.create({
    ...req.body,
    createdBy: req.user._id,
  });
  await User.findByIdAndUpdate(req.user._id, {
    $push: { workSpaces: { workSpace: newWorkSpace._id, role: 'owner' } },
  });
  res.status(201).json({
    status: 'success',
    data: {
      workSpace: newWorkSpace,
    },
  });
});

exports.updateWorkSpace = catchAsync(async (req, res, next) => {
  const workSpace = await WorkSpace.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!workSpace) {
    return next(new AppError('No workSpace found with this ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      workSpace,
    },
  });
});

exports.deleteWorkSpace = catchAsync(async (req, res, next) => {
  const workSpace = await WorkSpace.findByIdAndDelete(req.params.id);
  if (!workSpace) {
    return next(new AppError('No workSpace found with that ID', 404));
  }
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

//---------------------workSpaces belonging to a logged-in user ---------------------

exports.getOwnedWorkSpaces = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate({
    path: 'workSpaces.workSpace',
    select: 'name description createdAt',
  });

  if (!user) return next(new AppError('User not found', 404));

  const ownedWorkSpaces = user.workSpaces
    .filter((ws) => ws.role === 'owner')
    .map((ws) => ws.workSpace);

  res.status(200).json({
    status: 'success',
    results: ownedWorkSpaces.length,
    data: {
      ownedWorkSpaces,
    },
  });
});

exports.getMemberWorkSpaces = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate({
    path: 'workSpaces.workSpace',
    select: 'name description createdAt',
  });

  if (!user) return next(new AppError('User not found', 404));

  const memberWorkSpaces = user.workSpaces
    .filter(
      (ws) => ws.role === 'member' || ws.role === 'owner' || ws.role === 'admin'
    )
    .map((ws) => ws.workSpace);

  res.status(200).json({
    status: 'success',
    results: memberWorkSpaces.length,
    data: {
      memberWorkSpaces,
    },
  });
});

//-------------------check authorization-----------------------------------

exports.checkWorkspaceOwnership = catchAsync(async (req, res, next) => {
  const workSpace = await WorkSpace.findById(req.params.id);
  if (!workSpace) {
    return next(new AppError('No wrokSpace found with this ID', 404));
  }

  if (workSpace.canManage(req.user.id)) {
    req.workSpace = workSpace;
    return next();
  }
  return next(
    new AppError('You do not have permisson to perform this action!', 403)
  );
});

exports.checkworkspaceMembership = catchAsync(async (req, res, next) => {
  const workSpace = await WorkSpace.findById(req.params.id);

  if (!workSpace) {
    return next(new AppError('No workSpace with this ID', 404));
  }
  if (workSpace.isMember(req.user.id)) {
    req.workSpace = workSpace;
    return next();
  }
  return next(new AppError('You are not a member in this workSpace', 403));
});

//...............................workSpaces Stats......................................//

exports.getTotalWorkSpaces = catchAsync(async (req, res, next) => {
  const total = await WorkSpace.countDocuments();

  res.status(200).json({
    status: 'success',
    data: {
      totalWorkSpaces: total,
    },
  });
});

exports.getWorkSpacesUsersStats = catchAsync(async (req, res, next) => {
  const { workSpaceId } = req.params;
  const stats = await User.aggregate([
    { $match: { workSpace: workSpaceId } },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },

    { $project: { role: '$_id', count: 1, _id: 0 } },
  ]);
  res.status(200).json({
    status: 'success',
    data: { workSpaceId, stats },
  });
});

exports.getWorkSpaceUsersActiveStats = catchAsync(async (req, res, next) => {
  const { workSpaceId } = req.params;

  const stats = await User.aggregate([
    {
      $match: { workSpace: workSpaceId },
    },
    {
      $group: {
        _id: '$isActive',
        count: { $sum: 1 },
      },
    },

    {
      $project: {
        status: {
          $cond: [{ $eq: ['$_id', true] }, 'active', 'inactive'],
        },
        count: 1,
        _id: 0,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: { workSpaceId, stats },
  });
});
