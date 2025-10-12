const express = require('express');
const superAdminController = require('../controllers/superAdminController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes below
router.use(authController.protect);

// Restrict to SaaS-level super admin only
router.use(authController.restrictTo('super-admin'));

// SaaS-level routes
router.get('/users', superAdminController.getAllUsers);
router.get('/workspaces', superAdminController.getAllWorkspaces);

module.exports = router;
