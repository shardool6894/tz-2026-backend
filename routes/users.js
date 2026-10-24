const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const { userAction } = require('../middleware/rateLimits');
const { listMyInvites } = require('../controllers/teamController');
const { getUserEvents, getMe, addMyEvents, lookupUserByEmail, searchUsersByEmail } = require('../controllers/userController');

// router.get('/lookup', protect, userAction, lookupUserByEmail);
// router.get('/search', protect, userAction, searchUsersByEmail);
// router.get('/me', protect, getMe);
// router.get('/me/invites', protect, listMyInvites);
router.post('/me/events', protect, addMyEvents);
// router.get('/:userId/events', protect, requireAdmin, getUserEvents);


module.exports = router;