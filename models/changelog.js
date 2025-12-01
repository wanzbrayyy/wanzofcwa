const mongoose = require('mongoose');

const ChangelogSchema = new mongoose.Schema({
    version: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    publishedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Changelog', ChangelogSchema);