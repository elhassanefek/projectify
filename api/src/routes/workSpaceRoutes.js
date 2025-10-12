const express = require('express');
const workSpaceController = require('../controllers/workSpaceController');
const projectRouter = require('./projectRoutes');
const authController = require('../controllers/authController');

const router = express.Router();

// Nested routes -> /workspaces/:workSpaceId/projects
router.use('/:workSpaceId/projects', projectRouter);

// Protect all routes after this middleware
router.use(authController.protect);

// =============================
// Workspace CRUD Routes
// =============================

// Create a workspace (any authenticated user)
router.post('/', workSpaceController.createWorkSpace);

// Get all workspaces owned by logged-in user
router.get('/my-owned', workSpaceController.getOwnedWorkSpaces);

// Get all workspaces where logged-in user is member/admin/owner
router.get('/my-member', workSpaceController.getMemberWorkSpaces);

// Get workspace by ID (if user is a member or admin)
router.get(
  '/:id',
  workSpaceController.checkworkspaceMembership,
  workSpaceController.getWorkSpace
);

// Update workspace (only owner or admin)
router.patch(
  '/:id',
  workSpaceController.checkWorkspaceOwnership,
  workSpaceController.updateWorkSpace
);

// Delete workspace (only owner or admin)
router.delete(
  '/:id',
  workSpaceController.checkWorkspaceOwnership,
  workSpaceController.deleteWorkSpace
);

module.exports = router;
