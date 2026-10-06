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

const { toPublicUser } = require('../utils/publicUser');
const { attachUserToEventRegistration } = require('./teamController');
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

        for (const id of ids) {
            await attachUserToEventRegistration(id, req.user._id);
        }

        res.json({ user: toPublicUser(updated), added });
    } catch (err) {
        console.error('addMyEvents error:', err);
        res.status(500).json({ message: 'Could not add events' });
    }
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lookupUserByEmail = async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const found = await User.findOne({
            email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') },
        })
            .select('name email')
            .lean();
        if (!found) {
            return res.status(404).json({ message: 'No user found with that email' });
        }
        res.json({
            user: {
                id: String(found._id),
                name: found.name || '',
                email: found.email || '',
            },
        });
    } catch (err) {
        console.error('lookupUserByEmail error:', err);
        res.status(500).json({ message: 'Could not look up user' });
    }
};

const searchUsersByEmail = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (q.length < 2) {
            return res.status(400).json({ message: 'Type at least 2 characters to search' });
        }
        const users = await User.find({
            _id: { $ne: req.user._id },
            email: { $regex: escapeRegex(q), $options: 'i' },
        })
            .select('name email')
            .limit(8)
            .lean();

        res.json({
            users: users.map((u) => ({
                id: String(u._id),
                name: u.name || '',
                email: u.email || '',
            })),
        });
    } catch (err) {
        console.error('searchUsersByEmail error:', err);
        res.status(500).json({ message: 'Could not search users' });
    }
};

module.exports = { getUserEvents, getMe, addMyEvents, lookupUserByEmail, searchUsersByEmail, toPublicUser };