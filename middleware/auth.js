const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, process.env.jwt_key);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user no longer exists' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.roles !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = { protect, requireAdmin };