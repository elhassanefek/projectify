const express = require('express');
const tenantController = require('../controllers/tenantController');

const authController = require('../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, tenantController.getAllTenants)
  .post(tenantController.createTenant);

router
  .route('/:id')
  .get(tenantController.getTenant)
  .patch(tenantController.updateTenant)
  .delete(tenantController.deleteTenant);

module.exports = router;
