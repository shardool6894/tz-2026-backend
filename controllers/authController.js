const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { isNitwEmail, validateUploads } = require('../middleware/registrationChecks');

// Register
const register = async (req, res) => {
    try {
        const {
            name,
            password,
            collegeName,
            accommodation,
            registrationType = 'individual',
            teamMembers = [],
            events = [],
            idDocumentUrl = null,
            paymentScreenshotUrl = null
        } = req.body || {};
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        const uploadError = validateUploads({ email, idDocumentUrl, paymentScreenshotUrl });
        if (uploadError) {
            return res.status(400).json({ message: uploadError });
        }
        // Check if email already exists
        const exist = await User.findOne({ email });
        if (exist) {
            return res.status(400).json({ message: "Email already registered" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        // Validate team registration
        if (registrationType === 'team') {
            if (!Array.isArray(teamMembers) || teamMembers.length < 1) {
                return res.status(400).json({ 
                    message: "Team registration requires at least 1 additional member" 
                });
            }
            if (teamMembers.length > 4) {
                return res.status(400).json({ 
                    message: "Maximum team size is 5 members (including leader)" 
                });
            }
            // Validate each team member has a name
            const invalidMembers = teamMembers.filter(member => !member.name || member.name.trim() === '');
            if (invalidMembers.length > 0) {
                return res.status(400).json({ 
                    message: "All team members must have a name" 
                });
            }
        }
        const eventIds = [...new Set((Array.isArray(events) ? events : []).map(String))];
        if (eventIds.length === 0 || !eventIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ message: "Select at least one valid event" });
        }
        const validCount = await Event.countDocuments({ _id: { $in: eventIds }, registrationOpen: true });
        if (validCount !== eventIds.length) {
            return res.status(400).json({ message: "One or more selected events are invalid or closed" });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const accommodationBool = accommodation === true || accommodation === 'true' || accommodation === '1' || accommodation === 1;
        const role = 'user'
        // Prepare user payload
        const userPayload = {
            name,
            email,
            password: hashedPassword,
            roles : role,
            collegeName: collegeName || undefined,
            accommodation: accommodationBool,
            registrationType,
            teamMembers: registrationType === 'team' ? teamMembers : [],
            events: eventIds,
            idDocumentUrl,
            paymentScreenshotUrl : isNitwEmail(email) ? null : paymentScreenshotUrl
        };

        // Create user
        const user = await User.create(userPayload);

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.jwt_key, { expiresIn: '1h' });

        // Send response
        res.json({
            user: {
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
            },
            token
        });
        // res.status(400).json({message: "registration hasn't started"})

    } catch (err) {
        console.error('Register error:', err);
        
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            return res.status(400).json({ 
                message: Object.values(err.errors).map(e => e.message).join(', ') 
            });
        }
        
        res.status(500).json({ message: err.message });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { password } = req.body;
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!email || typeof password !== 'string' || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Incorrect Password" });
        const token = jwt.sign({ id: user._id }, process.env.jwt_key, { expiresIn: '1h' });

        res.json({
            user: {
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

            },
            token
        });
        // res.status(400).json({message: "registration hasn't started"})
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = { register, login };
