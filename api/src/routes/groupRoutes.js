const express = require('express');
const groupController = require('../controllers/projectGroupController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

//only logged-in users
router.use(authController.protect);

router.post('/', groupController.addGroup);
router
  .route('/:groupId')
  .patch(groupController.updateGroup)
  .delete(groupController.deleteGroup);

module.exports = router;
