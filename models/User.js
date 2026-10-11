const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    studentType: { type: String, enum: ['nitw', 'external'] },
    rollNumber: { type: String, default: null },
    participantId: { type: String },
    accommodation: { type: Boolean, default: false },
    needAccommodation: { type: Boolean, default: false }
}, { _id: false });

const counterSchema = new mongoose.Schema({
  name: String,
  seq: Number
});
const Counter = mongoose.model('Counter', counterSchema);

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    collegeName: { type: String },
    studentType: { type: String, enum: ['nitw', 'external'] },
    rollNumber: { type: String, default: null },
    participantId: { type: String },
    // One multikey index covers IDs of both the leader and every embedded member.
    participantIds: { type: [String], default: undefined, select: false },
    accommodation: { type: Boolean, default: false },
    needAccommodation: { type: Boolean, default: false },
    registrationType: { 
        type: String, 
        enum: ['individual', 'team'], 
        default: 'individual' 
    },
    registrationNum: { type: String, unique: true },
    teamMembers: { 
        type: [teamMemberSchema], 
        default: [],
        validate: {
            validator: function(arr) {
                if (this.registrationType === 'team') {
                    // 1-3 additional members = 2-4 total members including leader
                    return Array.isArray(arr) && arr.length >= 1 && arr.length <= 3;
                }
                return true;
            },
            message: 'Team must have 1-3 additional members (2-4 total including leader)'
        }
    },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    roles: { type: String, enum: ['user', 'admin'], default: 'user' },
    idDocumentUrl: { type: String, default: null },
    paymentScreenshotUrl: { type: String, default: null }
}, { timestamps: true });

// Sparse preserves existing accounts without changing their registration numbers.
userSchema.index({ participantIds: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function(next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { name: 'user' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.registrationNum = counter.seq.toString().padStart(3, '0');
  }
  next();
});

module.exports = mongoose.model('User', userSchema);