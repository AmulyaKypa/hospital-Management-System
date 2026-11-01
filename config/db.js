const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

// Retries a few times because the database may start after the app
async function connectDB(retries = 5) {
  while (retries > 0) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      retries--;
      console.error(`MongoDB connection failed (${retries} retries left): ${err.message}`);
      if (retries === 0) process.exit(1);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

module.exports = connectDB;
