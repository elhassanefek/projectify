const express = require('express');

const router = express.Router();
const projectController = require('../controllers/projectController');

//crud ops for projects

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

//stats endpoints
// router.get('/stats', projectController.getProjectsStats);
// router.get('/stats/by-manager', projectController.getProjectByManager);
// router.get('/stats/duration', projectController.getAvgProjectDuration);
module.exports = router;
