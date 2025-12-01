const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' }
}, { _id: false });

const projectSchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'untitled project' },
    description: { type: String, default: '' },
    projectType: { type: String, enum: ['bot', 'web'], default: 'bot' },
    port: { type: Number, default: null },
    subdomain: { type: String, default: null },
    team: [TeamMemberSchema],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', projectSchema);