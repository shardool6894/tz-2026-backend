const mongoose = require('mongoose');
//import contactSchema here before moving forward
const contactSchema = new mongoose.Schema({
    name : {type: String, default: ''},
    email : { type: String, default: ''},
    phone: { type: String, default: '' }
},{_id : false});
const eventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true }, // stable id used by the frontend, e.g. "robo-war"
    club: { type: String }, // organizing club/committee
    description: { type: String, default: '' },
    venue: { type: String, default: '' },
    startTime: { type: Date},
    endTime: { type: Date },
    registrationOpen: { type: Boolean, default: true },
    eventType: { type: String, default: '' },
    imgsrc: { type: String, default: '' },
    totalCost: { type: Number, default: null },
    cashPrize: { type: String, default: '' },
    teamSize: { type: String, default: '' },
    duration: { type: String, default: '' },
    rules: { type: [String], default: [] },
    judgingCriteria: { type: String, default: 'Coming Soon...' },
    contact: { type: [contactSchema], default: [] },
    glink: { type: String, default: '' },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    teams: [{
        leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        pendingInvites: [{
            invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            invitedAt: { type: Date, default: Date.now }
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);