const AuditLog = require('../models/AuditLog');

// Audit trail: records every change (POST/PUT/PATCH/DELETE) and every failed request
// (401/403/404/...) with who, what, when and the result. Request bodies are NOT stored,
// so passwords and clinical details never end up in the log.
module.exports = (req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'GET' && res.statusCode < 400) return;
    AuditLog.create({
      user: req.user?._id,
      username: req.user?.username || (typeof req.body?.username === 'string' ? req.body.username.slice(0, 50) : undefined),
      role: req.user?.role,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ip: req.ip,
    }).catch((err) => console.error('Audit write failed:', err.message));
  });
  next();
};
