const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  role: String,
  method: String,
  path: String,
  status: Number,
  ip: String,
  at: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('AuditLog', auditSchema);
