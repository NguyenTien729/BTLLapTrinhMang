const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

<<<<<<< HEAD
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  displayName: { type: String, trim: true, minlength: 2, maxlength: 60, default: function () { return this.username; } },
  isOnline: { type: Boolean, default: false },
  studentId: { type: String, default: '', maxlength: 30 },
  avatar: { type: String, default: '', maxlength: 2048 },
  bio: { type: String, default: '', maxlength: 500 },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });
=======
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Vui lòng nhập tên người dùng'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [2, 'Tên người dùng phải có ít nhất 2 ký tự'],
      maxlength: [50, 'Tên người dùng tối đa 50 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email tối đa 254 ký tự'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ']
    },
    password: {
      type: String,
      minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
      select: false
    },
    passwordHash: {
      type: String,
      select: false
    },
    displayName: {
      type: String,
      trim: true,
      default: function () {
        return this.username;
      }
    },
    avatar: {
      type: String,
      default: '',
      maxlength: [2048, 'Avatar URL quá dài']
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Tiểu sử tối đa 500 ký tự']
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordHash = this.password;
  }
  if (!this.displayName) {
    this.displayName = this.username;
  }
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  const hash = this.password || this.passwordHash;
  if (!hash) return false;
  return await bcrypt.compare(enteredPassword, hash);
};

// Omit password and passwordHash when converting to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
