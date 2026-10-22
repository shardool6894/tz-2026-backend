const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');

const {
    listEvents,
    createEvent,
    updateEvent,
    getEvent,
    getEventRegistrations
} = require('../controllers/eventController');
const {
    getEventTeam,
    sendTeamInvite,
    acceptTeamInvite,
    declineTeamInvite
} = require('../controllers/teamController');

router.get('/', listEvents);
router.post('/', protect, requireAdmin, createEvent);
router.get('/:eventId/team', protect, getEventTeam);
router.post('/:eventId/team/invites', protect, sendTeamInvite);
router.post('/:eventId/team/invites/accept', protect, acceptTeamInvite);
router.post('/:eventId/team/invites/decline', protect, declineTeamInvite);
router.get('/:eventId/registrations', protect, requireAdmin, getEventRegistrations);
router.get('/:eventId', getEvent);
router.put('/:eventId', protect, requireAdmin, updateEvent);

module.exports = router;