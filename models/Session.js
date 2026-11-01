const mongoose = require('mongoose');

// One document per sign-in. Revoking a session = setting revoked:true, which kills the JWT immediately.
const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  revoked: { type: Boolean, default: false },
  lastActivity: { type: Date, default: Date.now }, // used for inactivity logout
  ip: String,
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // MongoDB deletes it automatically
});

module.exports = mongoose.model('Session', sessionSchema);
