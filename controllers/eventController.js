const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');

const WRITABLE_FIELDS = [
    'name', 'club', 'description', 'venue', 'startTime', 'endTime', 'slug', 'registrationOpen',
    'eventType', 'imgsrc', 'totalCost', 'cashPrize', 'teamSize', 'duration', 'rules', 'judgingCriteria', 'contact', 'glink'
];

const pickWritableFields = (body) => {
    const out = {};
    for (const field of WRITABLE_FIELDS) {
        if (body[field] !== undefined) out[field] = body[field];
    }
    if (out.slug !== undefined) {
        const slug = String(out.slug).trim();
        if (slug) out.slug = slug; else delete out.slug;
    }
    if (out.startTime) out.startTime = new Date(out.startTime);
    if (out.endTime) out.endTime = new Date(out.endTime);
    return out;
};

// GET /api/events
const listEvents = async (req, res) => {
    try {
        const events = await Event.find()
            .select('-users -teams')
            .sort({ startTime: 1 })
            .lean();
        res.json({ count: events.length, events });
    } catch (err) {
        console.error('listEvents error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/events/:eventId
const getEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' });
        }
        const event = await Event.findById(eventId).select('-users -teams').lean();
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (err) {
        console.error('getEvent error:', err);
        res.status(500).json({ message: err.message });
    }
};

// POST /api/events
const createEvent = async (req, res) => {
    try {
        const fields = pickWritableFields(req.body || {});

        if (!fields.name) {
            return res.status(400).json({ message: 'name is required' });
        }
        if (!fields.slug) {
            fields.slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        const event = await Event.create(fields);
        res.status(201).json(event);
    } catch (err) {
        console.error('createEvent error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        if (err.code === 11000) {
            return res.status(400).json({ message: 'An event with that slug already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/events/:eventId
const updateEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' });
        }

        const updates = pickWritableFields(req.body || {});

        const event = await Event.findByIdAndUpdate(eventId, updates, { new: true, runValidators: true });
        if (!event) return res.status(404).json({ message: 'Event not found' });

        res.json(event);
    } catch (err) {
        console.error('updateEvent error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        res.status(500).json({ message: err.message });
    }
};

// GET /api/events/:eventId/registrations
const getEventRegistrations = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'Invalid event id' });
        }

        const registrations = await User.find({ events: eventId })
            .select('name email collegeName registrationType teamMembers registrationNum accommodation')
            .lean();

        res.json({
            eventId,
            count: registrations.length,
            registrations
        });
    } catch (err) {
        console.error('getEventRegistrations error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = { listEvents, getEvent, createEvent, updateEvent, getEventRegistrations };