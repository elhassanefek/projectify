const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/', userController.getAllUsers);
router.route('/:id').get(userController.getUser);

module.exports = router;
