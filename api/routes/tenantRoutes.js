const express = require('express');

const router = express.Router();
const tenantController = require('../controllers/tenantController');

router.route('/').get(tenantController.getAllTenants);

module.exports = router;
