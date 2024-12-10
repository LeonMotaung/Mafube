const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    surname: {
        type: String,
        required: [true, 'Surname is required'],
        trim: true
    },
    idNumber: {
        type: String,
        required: [true, 'ID Number is required'],
        unique: true,
        trim: true
    },
    wardNumber: {
        type: Number,
        required: [true, 'Ward Number is required']
    },
    town: {
        type: String,
        required: [true, 'Town is required'],
        enum: ['Frankfort', 'Villiers', 'Cornelia', 'Tweeling']
    },
    suburb: {
        type: String,
        required: [true, 'Suburb is required'],
        trim: true
    },
    postalCode: {
        type: String,
        required: [true, 'Postal Code is required'],
        trim: true,
        validate: {
            validator: function(v) {
                return /^\d{4}$/.test(v);
            },
            message: 'Postal Code must be 4 digits'
        }
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        enum: {
            values: ['Free State'],
            message: 'State must be Free State'
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);