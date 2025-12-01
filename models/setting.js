const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    maintenance: { type: Boolean, default: false },
    onboarding: [{
        title: String,
        message: String,
        imageUrl: String,
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    }],
    flashSale: {
        active: { type: Boolean, default: false },
        endTime: { type: Date },
        title: { type: String, default: 'Flash Sale' },
        description: { type: String, default: 'Limited time offer!' },
        price: { type: Number, default: 0 }, 
        isFree: { type: Boolean, default: false },
        rewardSlots: { type: Number, default: 1 } 
    }
});

module.exports = mongoose.model('Setting', SettingSchema);
