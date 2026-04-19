const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');




router.post('/ai-review', aiController.getAIReview);




module.exports = router;