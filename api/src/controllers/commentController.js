const commentService = require('../services/commentService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all comments (same as before)
exports.getAllComments = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.params.taskId) filter.task = req.params.taskId;
  if (req.query.project) filter.project = req.query.project;
  if (req.query.workspace) filter.workspace = req.query.workspace;
  if (req.query.parentComment === 'null') filter.parentComment = null;

  const comments = await commentService.getAllComments(filter);

  res.status(200).json({
    status: 'success',
    results: comments.length,
    data: { comments },
  });
});

exports.getComment = catchAsync(async (req, res, next) => {
  const comment = await commentService.getCommentById(req.params.id);
  res.status(200).json({
    status: 'success',
    data: { comment },
  });
});

exports.createComment = catchAsync(async (req, res, next) => {
  if (req.params.taskId && !req.body.task) req.body.task = req.params.taskId;
  req.body.user = req.user.id;

  const newComment = await commentService.createComment(req.body);

  res.status(201).json({
    status: 'success',
    data: { comment: newComment },
  });
});

exports.getAllReplies = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const replies = await commentService.getReplies(id);

  res.status(200).json({
    status: 'success',
    results: replies.length,
    data: { replies },
  });
});

// ✅ UPDATED CONTROLLER
exports.updateComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Allow only safe fields
  const allowedFields = ['text'];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0)
    return next(new AppError('No valid fields to update', 400));

  const updatedComment = await commentService.updateComment(id, updates);

  res.status(200).json({
    status: 'success',
    data: { comment: updatedComment },
  });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const comment = await commentService.deleteComment(id);
  if (!comment) return next(new AppError('No comment found with that ID', 404));

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.checkOwnership = catchAsync(async (req, res, next) => {
  req.comment = await commentService.checkOwnership(
    req.params.id,
    req.user._id
  );
  next();
});
