const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    wardNumber: {
        type: Number,
        required: true
    },
    town: {
        type: String,
        required: true
    },
    image: {
        data: Buffer,
        contentType: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);