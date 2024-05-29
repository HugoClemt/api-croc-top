const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    birthday: { type: Date, required: true },
    bio: { type: String },
    picture_avatar: { type: String },
    signup_date: { type: Date, default: Date.now },
    last_login: { type: Date, default: Date.now },
    status: { type: String, enum: ['online', 'inactive'], default: 'inactive' },
    role: { type: String, enum: ['normal', 'partner', 'certified'], default: 'normal' },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }]
});

module.exports = mongoose.model('User', userSchema);
