const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    surname: {
        type: String,
        required: true,
        trim: true
    },
    idNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    wardNumber: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    },
    suburb: {
        type: String,
        required: true,
        trim: true
    },
    town: {
        type: String,
        required: true,
        enum: ['Frankfort', 'Villiers', 'Cornelia', 'Tweeling']
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    postalCode: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);