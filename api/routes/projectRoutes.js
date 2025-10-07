const express = require('express');

const projectController = require('../controllers/projectController');
const authController = require('./../controllers/authController');
const taskRouter = require('../routes/taskRoutes');
const groupRouter = require('./groupRoutes');
const router = express.Router({ mergeParams: true });

//nested routes
router.use('/:projectId/groups', groupRouter);
router.use('/:projectId/tasks', taskRouter);

//add protected routes
router.use(authController.protect);
//crud ops for projects

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// router
//   .route('/:projectId/tasks')
//   .post(
//     authController.protect,
//     authController.restrictTo('user'),
//     taskController.createTask
//   );

//stats endpoints
// router.get('/stats', projectController.getProjectsStats);
// router.get('/stats/by-manager', projectController.getProjectByManager);
// router.get('/stats/duration', projectController.getAvgProjectDuration);
module.exports = router;
