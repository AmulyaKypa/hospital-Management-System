const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Session = require('../models/Session');

// Verifies the JWT, then checks the matching Session in the database:
// not revoked, and active within the last IDLE_MINUTES. Touching lastActivity and checking
// the idle limit happen in ONE atomic query.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const idleLimit = new Date(Date.now() - env.IDLE_MINUTES * 60 * 1000);
  const session = await Session.findOneAndUpdate(
    { _id: payload.sid, revoked: false, lastActivity: { $gt: idleLimit } },
    { lastActivity: new Date() },
    { new: true }
  ).populate('user');

  if (!session || !session.user || !session.user.active) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  req.user = session.user;
  req.session = session;
  next();
}

// Role-based access control. Admin is always allowed; authorize() with no roles means "admin only".
const authorize = (...roles) => (req, res, next) =>
  req.user.role === 'admin' || roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to do this' });

module.exports = { authenticate, authorize };
