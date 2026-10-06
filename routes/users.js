const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const { getUserEvents, getMe, addMyEvents } = require('../controllers/userController');

router.get('/:userId/events', protect, requireAdmin, getUserEvents);
router.get('/me', protect, getMe);
router.post('/me/events', protect, addMyEvents);


module.exports = router;