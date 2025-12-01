const mongoose = require('mongoose');

const TutorialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    youtubeUrl: { type: String, default: '' },
    category: { type: String, default: 'General' },
    steps: [{ type: String }], 
    thumbnail: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tutorial', TutorialSchema);
