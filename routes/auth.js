// Sign in / sign out / current user
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const User = require('../models/User');
const Session = require('../models/Session');
const { authenticate } = require('../middleware/auth');
const httpError = require('../utils/httpError');
const { checkPassword, checkUsername } = require('../utils/password');
const { createPatient } = require('../services/patients');
const router = express.Router();

// Brute-force protection: 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many registration attempts. Try again in 15 minutes.' },
});

// Compared against when the username does not exist, so response time doesn't reveal valid usernames
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/register', registrationLimiter, async (req, res) => {
  const { username, password, fullName, age, gender, contact, address } = req.body;
  checkUsername(username);
  checkPassword(password);
  if (typeof fullName !== 'string' || !fullName.trim()) throw httpError(400, 'Full name is required');
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 120) throw httpError(400, 'Age must be a whole number between 0 and 120');
  if (typeof gender !== 'string' || !['male', 'female', 'other'].includes(gender)) throw httpError(400, 'Choose a valid gender');
  if (typeof contact !== 'string' || !contact.trim()) throw httpError(400, 'Contact is required');
  if (address !== undefined && typeof address !== 'string') throw httpError(400, 'Address must be text');

  const patient = await createPatient({
    name: fullName.trim(), age, gender, contact: contact.trim(), address: address || '',
  });
  let user;
  try {
    user = await User.create({
      username: username.trim(), fullName: fullName.trim(), role: 'patient', patient: patient._id,
      passwordHash: await bcrypt.hash(password, 10),
    });
  } catch (err) {
    await patient.deleteOne().catch((cleanupError) => console.error('Patient cleanup failed after registration error:', cleanupError));
    throw err;
  }
  res.status(201).json({ user: user.toPublic(), message: 'Account created. You can now sign in.' });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, role } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || typeof role !== 'string') {
    throw httpError(400, 'Username, password and role are required');
  }

  const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  // The chosen role must match the account's role. One generic message, so nothing reveals which part was wrong.
  if (!user || !passwordOk || !user.active || user.role !== role) throw httpError(401, 'Invalid username, password or role');

  // A session record lets us revoke access instantly and enforce inactivity logout
  const session = await Session.create({
    user: user._id, ip: req.ip, expiresAt: new Date(Date.now() + env.TOKEN_HOURS * 3600 * 1000),
  });
  const token = jwt.sign({ sid: session.id }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: `${env.TOKEN_HOURS}h` });
  res.json({ token, user: user.toPublic() });
});

router.post('/logout', authenticate, async (req, res) => {
  await Session.updateOne({ _id: req.session._id }, { revoked: true });
  res.json({ message: 'Signed out' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user.toPublic(), idleMinutes: env.IDLE_MINUTES });
});

module.exports = router;
