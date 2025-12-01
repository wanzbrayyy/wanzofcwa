const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    orderId: { type: Strong, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['upgrade', 'donation', 'server_slot', 'bot_slot'], required: true }, 
    amount: { type: Number, required: true },
    details: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
