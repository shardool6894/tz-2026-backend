const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    name: { type: String, required: true }
}, { _id: false }); // _id: false prevents Mongoose from creating an _id for each team member

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
    accommodation: { type: Boolean, default: false },
    registrationType: { 
        type: String, 
        enum: ['individual', 'team'], 
        default: 'individual' 
    },
    registrationNum: { type: String, unique: true },
    emailVerified: { type: Boolean, default: false },
    // select:false keeps these out of normal query results and API responses
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },
    emailVerificationSentAt: { type: Date, default: null, select: false },
    teamMembers: { 
        type: [teamMemberSchema], 
        default: [],
        validate: {
            validator: function(arr) {
                if (this.registrationType === 'team') {
                    return arr.length >= 1 && arr.length <= 4;
                }
                return true;
            },
            message: 'Team must have 1-4 additional members (2-5 total including leader)'
        }
    },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    roles: {type: String, enum: ['user', 'admin'], default: 'user'},
    idDocumentUrl: { type: String, default: null },
    paymentScreenshotUrl: { type: String, default: null },
    registrationNum: { type: String, unique: true }
}, { timestamps: true });

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
