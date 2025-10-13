const Comment = require('../models/commentModel');

class CommentRepository {
  async create(data) {
    return await Comment.create(data);
  }

  async findAll(filter = {}) {
    return await Comment.find(filter)
      .populate('user', 'name')
      .populate('parentComment', 'text user')
      .sort({ createdAt: -1 });
  }

  async findById(id) {
    return await Comment.findById(id)
      .populate('user', 'name')
      .populate('parentComment', 'text user');
  }

  async findReplies(parentCommentId) {
    return await Comment.find({ parentComment: parentCommentId })
      .populate('user', 'name')
      .sort({ createdAt: 1 });
  }

  async deleteById(id) {
    return await Comment.findByIdAndDelete(id);
  }

  async update(id, updates) {
    return await Comment.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('user', 'name')
      .populate('parentComment', 'text user');
  }
}

module.exports = new CommentRepository();
