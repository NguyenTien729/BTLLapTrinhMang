const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  avatar: { type: String, default: '', maxlength: 2048 },
  bio: { type: String, default: '', maxlength: 500 },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.set('toJSON', { transform(_doc, ret) { delete ret.passwordHash; delete ret.__v; return ret; } });
module.exports = mongoose.model('User', userSchema);
