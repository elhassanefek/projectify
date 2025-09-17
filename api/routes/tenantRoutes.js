const express = require('express');

const router = express.Router();

//create a tenant
router.route('/').post();

// later auth for just admin
router.route('/').get();

router.route('/:id').get().patch().delete();

module.exports = router;
