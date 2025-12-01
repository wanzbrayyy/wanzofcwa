const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String, default: '' },
    tag: { type: String, default: 'General' },
    type: { type: String, enum: ['news', 'tutorial'], required: true },
    author: { type: String, default: 'wanzofc' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
