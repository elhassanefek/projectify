const express = require('express');
const commentController = require('../controllers/commentController');
const authController = require('../controllers/authController');
const router = express.Router({ mergeParams: true });

// GET /api/v1/comments?task=taskId&project=projectId&workspace=workspaceId

router.use(authController.protect);
router
  .route('/')
  .get(commentController.getAllComments)
  .post(commentController.createComment);

// GET /api/v1/comments/:commentId/replies
router.get('/:id', commentController.getComment);
router.patch(
  '/:id',
  commentController.checkOwnership,
  commentController.updateComment
);
router.get('/:commentId/replies', commentController.getAllReplies);

// DELETE /api/v1/comments/:id
router.delete('/:id', commentController.deleteComment);

module.exports = router;
