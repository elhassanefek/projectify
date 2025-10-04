const WorkSpace = require('../models/workSpaceModel');
const User = require('../models/userModel');

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appErrors');

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
