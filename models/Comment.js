const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    town: {
        type: String,
        required: true,
        enum: ['Frankfort', 'Villiers', 'Cornelia', 'Tweeling']
    },
    wardNumber: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Comment', commentSchema);