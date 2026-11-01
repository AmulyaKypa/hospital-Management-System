// User administration (admin only)
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const { authorize } = require('../middleware/auth');
const { checkPassword, checkUsername } = require('../utils/password');
const { isId } = require('../utils/ids');
const httpError = require('../utils/httpError');
const pick = require('../utils/pick');
const router = express.Router();

router.use(authorize()); // no roles listed = admin only

router.get('/', async (req, res) => {
  const users = await User.find().sort({ username: 1 });
  res.json(users.map((u) => u.toPublic()));
});

// Doctor and patient logins must be linked to a doctor profile / patient record
router.post('/', async (req, res) => {
  checkUsername(req.body.username);
  checkPassword(req.body.password);
  const data = pick(req.body, ['username', 'fullName', 'role']);
  if (data.role === 'doctor') {
    if (!isId(req.body.doctor) || !(await Doctor.exists({ _id: req.body.doctor }))) throw httpError(400, 'Choose the doctor profile this login belongs to');
    data.doctor = req.body.doctor;
  }
  if (data.role === 'patient') {
    if (!isId(req.body.patient) || !(await Patient.exists({ _id: req.body.patient }))) throw httpError(400, 'Choose the patient record this login belongs to');
    data.patient = req.body.patient;
  }
  const user = await User.create({ ...data, passwordHash: await bcrypt.hash(req.body.password, 10) });
  res.status(201).json(user.toPublic());
});

router.patch('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');

  const changes = pick(req.body, ['fullName', 'active']); // role changes are not allowed: create a new login instead
  if (user.id === req.user.id && changes.active === false) throw httpError(400, 'You cannot lock yourself out');
  Object.assign(user, changes);
  if (req.body.password !== undefined) {
    checkPassword(req.body.password);
    user.passwordHash = await bcrypt.hash(req.body.password, 10);
  }
  await user.save();

  // Deactivating a user or changing their password signs them out everywhere
  if (changes.active === false || req.body.password !== undefined) {
    await Session.updateMany({ user: user._id, revoked: false }, { revoked: true });
  }
  res.json(user.toPublic());
});

// Session revocation: force a user to sign in again
router.post('/:id/revoke-sessions', async (req, res) => {
  const result = await Session.updateMany({ user: req.params.id, revoked: false }, { revoked: true });
  res.json({ message: `Signed out ${result.modifiedCount} session(s)` });
});

module.exports = router;
