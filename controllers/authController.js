const User = require('../models/User');
const { buildParticipantIdentities } = require('../utils/participantIdentity');
const { toPublicUser } = require('../utils/publicUser');
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
            rollNumber,
            accommodation,
            needAccommodation,
            needAccomodation,
            registrationType = 'individual',
            teamMembers = [],
            events = [],
            idDocumentUrl = null,
            paymentScreenshotUrl = null
        } = req.body || {};
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const memberList = registrationType === 'team' && Array.isArray(teamMembers) ? teamMembers : [];
        const requiresPayment =
            !isNitwEmail(email) || memberList.some((member) => member?.studentType !== 'nitw');
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        const uploadError = validateUploads({ email, idDocumentUrl, paymentScreenshotUrl, requiresPayment });
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
            const invalidMembers = teamMembers.filter(member => !member || typeof member.name !== 'string' || !member.name.trim());
            if (invalidMembers.length > 0) {
                return res.status(400).json({ 
                    message: "All team members must have a name" 
                });
            }
        }
        const identities = buildParticipantIdentities({
            email, rollNumber, teamMembers: registrationType === 'team' ? teamMembers : [],
        });
        const eventIds = [...new Set((Array.isArray(events) ? events : []).map(String))];
        // Events are optional at registration; users can add them later from their profile
        if (!eventIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ message: "One or more selected events are invalid" });
        }
        if (eventIds.length > 0) {
            const validCount = await Event.countDocuments({ _id: { $in: eventIds }, registrationOpen: true });
            if (validCount !== eventIds.length) {
                return res.status(400).json({ message: "One or more selected events are invalid or closed" });
            }
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const accommodationBool =
            accommodation === true || accommodation === 'true' || accommodation === '1' || accommodation === 1 ||
            needAccommodation === true || needAccommodation === 'true' || needAccommodation === '1' || needAccommodation === 1 ||
            needAccomodation === true || needAccomodation === 'true' || needAccomodation === '1' || needAccomodation === 1;
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
            ...identities,
            events: eventIds,
            idDocumentUrl,
            paymentScreenshotUrl: requiresPayment ? paymentScreenshotUrl : null,
        };

        // Create user
        let user;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                user = await User.create(userPayload);
                break;
            } catch (error) {
                const conflictingId = error.keyValue?.participantIds;
                const externalIds = [
                    ...(userPayload.studentType === 'external' ? [userPayload.participantId] : []),
                    ...userPayload.teamMembers.filter(member => member.studentType === 'external').map(member => member.participantId),
                ];
                if (attempt === 4 || error.code !== 11000 || !error.keyPattern?.participantIds || !externalIds.includes(conflictingId)) {
                    throw error;
                }
                // A short random ID can collide; regenerate before retrying the atomic insert.
                Object.assign(userPayload, buildParticipantIdentities({ email, rollNumber, teamMembers: registrationType === 'team' ? teamMembers : [] }));
            }
        }

        res.status(201).json({
            message: "Account created successfully.",
            email: user.email,
            participants: [
                { name: user.name, studentType: user.studentType, rollNumber: user.rollNumber, participantId: user.participantId },
                ...user.teamMembers.map((member) => ({
                    name: member.name, studentType: member.studentType, rollNumber: member.rollNumber, participantId: member.participantId,
                })),
            ]
        });

    } catch (err) {
        if (err.status === 400) return res.status(400).json({ message: err.message });
        if (err.code === 11000 && err.keyPattern?.participantIds) {
            return res.status(409).json({ message: /^26TZ[A-Z0-9]{4}$/.test(err.keyValue?.participantIds || '')
                ? 'Could not assign a unique participant ID. Please try again.'
                : 'A participant is already registered with that roll number. Please check the team details.' });
        }
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
            user: toPublicUser(user),
            token
        });
        // res.status(400).json({message: "registration hasn't started"})
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = { register, login };
