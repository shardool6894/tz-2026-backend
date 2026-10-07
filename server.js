const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config();
// const whitelist = ['https://technozion.nitw.ac.in/', 'http://localhost:3000'];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (whitelist.indexOf(origin) !== -1 || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   }
// };

// app.use(cors(corsOptions)); // to prevent access from untrusted origins
const REQUIRED_ENV = ['MONGO_URI', 'jwt_key'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key] || !process.env[key].trim());
if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Add them to BACKEND/.env (see .env.example) and restart.');
  process.exit(1);
}
if (process.env.jwt_key.length < 16) {
  console.warn('Warning: jwt_key is very short. Use a long random string in production.');
}
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
  
app.use(cors({
  origin: (origin, cb) => {
    // no Origin header = curl/Postman/same-origin; allow
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

const eventRoutes = require('./routes/events')
app.use('/api/events', eventRoutes)

const userRoutes = require('./routes/users')
app.use('/api/users', userRoutes)
//add enrollment routes here
const PORT = process.env.PORT || 5000;
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
  app.get('/api/health', (req, res) =>
  res.json({ resendKey: !!process.env.RESEND_API_KEY, from: !!(process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM) })
  );
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};
start();
module.exports = app