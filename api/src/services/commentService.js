const commentRepository = require('../repositories/commentRepository');
const AppError = require('../utils/appError');
const taskService = require('../services/taskService');

class CommentService {
  async createComment(data) {
    const { text, task, project, workspace } = data;

    if (!text) throw new AppError('A comment must have text', 400);
    if (!task && !project && !workspace) {
      throw new AppError(
        'A comment must be associated with at least one of: task, project, or workspace',
        400
      );
    }

    if (task) {
      const exists = await taskService.checkExistance(task);
      if (!exists) throw new AppError('No task found with this ID', 404);
    }

    return await commentRepository.create(data);
  }

  async getAllComments(filter) {
    return await commentRepository.findAll(filter);
  }

  async getCommentById(id) {
    const comment = await commentRepository.findById(id);
    if (!comment) throw new AppError('No comment found with this ID', 404);
    return comment;
  }

  async getReplies(commentId) {
    return await commentRepository.findReplies(commentId);
  }

  async deleteComment(id) {
    return await commentRepository.deleteById(id);
  }

  //  FIXED UPDATE LOGIC
  async updateComment(id, data) {
    const existing = await commentRepository.findById(id);
    if (!existing) throw new AppError('No comment found with this ID', 404);

    const updated = await commentRepository.update(id, data);
    if (!updated) throw new AppError('Failed to update comment', 500);

    return updated;
  }

  async checkOwnership(commentId, userId) {
    const comment = await commentRepository.findById(commentId);
    if (!comment) throw new AppError('No comment found with this ID', 404);
    console.log(comment);
    if (!comment.canEdit(userId)) {
      throw new AppError(
        'You do not have permission to perform this action',
        403
      );
    }

    return comment;
  }
}

module.exports = new CommentService();
