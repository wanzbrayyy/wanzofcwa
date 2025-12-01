const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    botname: { type: String, default: 'FIONA BOT' },
    ownerName: { type: String, default: 'OWNER' },
    ownerNumber: { type: String, default: '6289526346592' },
    telegram: { type: String, default: 'https://t.me/maverick_dar' },
    audioUrl: { type: String, default: 'https://files.catbox.moe/j2l430.mp3' },
    ppobApiKey: { type: String, default: '' },
    delayPush: { type: Number, default: 3000 },
    delayJpm: { type: Number, default: 4000 },   
    payName: { type: String, default: '' },
    payDana: { type: String, default: '' },
    payGopay: { type: String, default: '' },
    payOvo: { type: String, default: '' },
    payQris: { type: String, default: '' }
}, { _id: false });

const SessionSchema = new mongoose.Schema({
    sessionId: String,
    phoneNumber: String,
    status: { type: String, default: 'disconnected' },
    config: ConfigSchema,
    customCode: { type: String, default: '' }
}, { _id: false });

const ActivityLogSchema = new mongoose.Schema({
    action: String,
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const LoginHistorySchema = new mongoose.Schema({
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    fullname: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    
    spotifyId: { type: String, default: null },
    githubId: { type: String, default: null },

    profilePic: { type: String, default: 'https://files.catbox.moe/k3612t2.jpg' },
    twoFactorSecret: String,
    twoFactorEnabled: { type: Boolean, default: false },
    sseoToken: { type: String, default: null },
    sseoActive: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    serverSlots: { type: Number, default: 1 }, 
    maxSessions: { type: Number, default: 2 },
    enableNotif: { type: Boolean, default: true },
    flashSaleClaimed: { type: Boolean, default: false },
    
    sessionVersion: { type: Number, default: 1 },
    activityLogs: [ActivityLogSchema],
    loginHistory: [LoginHistorySchema],

    defaultConfig: ConfigSchema, 
    sessions: [SessionSchema]
});

module.exports = mongoose.model('User', UserSchema);
