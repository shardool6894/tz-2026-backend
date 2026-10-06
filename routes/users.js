const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const { getUserEvents, getMe, addMyEvents, lookupUserByEmail, searchUsersByEmail } = require('../controllers/userController');

router.get('/lookup', protect, lookupUserByEmail);
router.get('/search', protect, searchUsersByEmail);
router.get('/me', protect, getMe);
router.post('/me/events', protect, addMyEvents);
router.get('/:userId/events', protect, requireAdmin, getUserEvents);


module.exports = router;