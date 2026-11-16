const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu MONGO_URI.');
  await mongoose.connect(uri);
  console.log('MongoDB Atlas connected!');
}

module.exports = connectDB;
