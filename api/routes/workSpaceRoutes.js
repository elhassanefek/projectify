const express = require('express');
const workSpaceController = require('../controllers/workSpaceController');

const authController = require('../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, workSpaceController.getAllWorkSpaces)
  .post(authController.protect, workSpaceController.createWorkSpace);

router
  .route('/:id')
  .get(workSpaceController.getWorkSpace)
  .patch(workSpaceController.updateWorkSpace)
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'manager'),
    workSpaceController.deleteWorkSpace
  );

module.exports = router;
