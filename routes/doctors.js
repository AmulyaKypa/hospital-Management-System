// Doctor profiles: specialization, availability and linked login
const express = require('express');
const Doctor = require('../models/Doctor');
const { authorize } = require('../middleware/auth');
const { nextCode } = require('../services/sequence');
const { createLinkedAccount, getDefaultAccountPassword } = require('../services/accounts');
const httpError = require('../utils/httpError');
const pick = require('../utils/pick');
const router = express.Router();

const FIELDS = ['name', 'specialization', 'contact', 'fee', 'availability'];

router.get('/', async (req, res) => {
  res.json(await Doctor.find().sort({ name: 1 }));
});

// Admin adds a doctor profile and a linked login using the configured default password.
router.post('/', authorize(), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (req.body.username !== undefined || req.body.password !== undefined) throw httpError(400, 'Doctor logins are generated automatically');
  const password = getDefaultAccountPassword();
  await new Doctor({ ...data, doctorId: 'TEMP' }).validate();
  const doctor = await Doctor.create({ ...data, doctorId: await nextCode('doctor', 'D') });

  try {
    const login = await createLinkedAccount({ fullName: doctor.name, role: 'doctor', doctor: doctor._id, password });
    res.status(201).json({ ...doctor.toObject(), login });
  } catch (err) {
    await Doctor.deleteOne({ _id: doctor._id }).catch((cleanupError) => console.error('Doctor cleanup failed after account creation error:', cleanupError));
    throw err;
  }
});

// Admin edits any field; a doctor may only change their own contact and availability
router.put('/:id', authorize('doctor'), async (req, res) => {
  let update;
  if (req.user.role === 'admin') update = pick(req.body, FIELDS);
  else if (req.user.doctor && String(req.user.doctor) === req.params.id) update = pick(req.body, ['contact', 'availability']);
  else throw httpError(403, 'You can only edit your own profile');

  const doctor = await Doctor.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!doctor) throw httpError(404, 'Doctor not found');
  res.json(doctor);
});

module.exports = router;
