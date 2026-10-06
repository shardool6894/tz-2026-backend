const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');

const getUserEvents = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const user = await User.findById(userId)
            .select('events')
            .populate('events') // swap for .populate('events', 'name startTime endTime venue club') to trim the payload
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            userId,
            count: user.events.length,
            events: user.events
        });
    } catch (err) {
        console.error('getUserEvents error:', err);
        res.status(500).json({ message: err.message });
    }
};

// Same shape the login/register responses return, so the frontend can swap it straight in
const toPublicUser = (user) => ({
    name: user.name,
    email: user.email,
    role: user.roles,
    collegeName: user.collegeName || null,
    accommodation: !!user.accommodation,
    registrationType: user.registrationType,
    teamMembers: user.teamMembers || [],
    events: user.events || [],
    idDocumentUrl: user.idDocumentUrl,
    paymentScreenshotUrl: user.paymentScreenshotUrl,
    registrationNum: user.registrationNum
});
const getMe = (req, res) => {
    res.json({ user: toPublicUser(req.user) });
};
// POST /api/users/me/events - add events to the logged-in user's registration
const addMyEvents = async (req, res) => {
    try {
        const { events } = req.body || {};
        const ids = [...new Set((Array.isArray(events) ? events : []).map(String))];
        if (ids.length === 0 || !ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ message: 'Select at least one valid event' });
        }

        const validCount = await Event.countDocuments({ _id: { $in: ids }, registrationOpen: true });
        if (validCount !== ids.length) {
            return res.status(400).json({ message: 'One or more selected events are invalid or closed' });
        }

        const already = new Set((req.user.events || []).map(String));
        const added = ids.filter((id) => !already.has(id)).length;

        // $addToSet never duplicates an event the user already has
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { $addToSet: { events: { $each: ids } } },
            { new: true }
        ).select('-password');

        res.json({ user: toPublicUser(updated), added });
    } catch (err) {
        console.error('addMyEvents error:', err);
        res.status(500).json({ message: 'Could not add events' });
    }
};

+module.exports = { getUserEvents, getMe, addMyEvents };