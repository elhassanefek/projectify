const Tenant = require('../models/tenantModel');
const User = require('../models/userModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appErrors');

//............................CRUD OPS for the tenants........................................//
exports.getAllTenants = catchAsync(async (req, res) => {
  const tenants = await Tenant.find();

  res.status(200).json({
    status: 'success',
    data: tenants,
  });
});

exports.getTenant = catchAsync(async (req, res, next) => {
  const tenant = await Tenant.findById(req.params.id);

  if (!tour) {
    return next(new AppError('No tenant found with this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      tenant,
    },
  });
});

exports.createTenant = catchAsync(async (req, res, next) => {
  const newTenant = await Tenant.create(req.body);
  res.status(201).json({
    status: 'success',
    data: {
      tenant: newTenant,
    },
  });
});

exports.updateTenant = catchAsync(async (req, res, next) => {
  const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!tenant) {
    return next(new AppError('No tenant found with this ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      tenant,
    },
  });
});

exports.deleteTenant = catchAsync(async (req, res, next) => {
  const tenant = await Tenant.findByIdAndDelete(req.params.id);
  if (!tenant) {
    return next(new AppError('No tenant found with that ID', 404));
  }
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

//...............................Tenant Stats......................................//

exports.getTotalTenants = catchAsync(async (req, res, next) => {
  const total = await Tenant.countDocuments();

  res.status(200).json({
    status: 'success',
    data: {
      totalTenants: total,
    },
  });
});

exports.getTenantUsersStats = catchAsync(async (req, res, next) => {
  const { tenantId } = req.params;
  const stats = await User.aggregate([
    { $match: { tenant: tenantId } },
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
    data: { tenantId, stats },
  });
});

exports.getTenantUsersActiveStats = catchAsync(async (req, res, next) => {
  const { tenantId } = req.params;

  const stats = await User.aggregate([
    {
      $match: { tenant: tenantId },
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
    data: { tenantId, stats },
  });
});
