// Patients: registration, search, assignment to doctors, medical history and lab reports
const express = require('express');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Session = require('../models/Session');
const { authorize } = require('../middleware/auth');
const { createPatient } = require('../services/patients');
const { createLinkedAccount, getDefaultAccountPassword } = require('../services/accounts');
const { isId } = require('../utils/ids');
const httpError = require('../utils/httpError');
const pick = require('../utils/pick');
const router = express.Router();

const FIELDS = ['name', 'age', 'gender', 'contact', 'address', 'bloodGroup', 'allergies', 'condition'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Who may see a patient's record: admin/staff all, a doctor only their assigned patients, a patient only themselves
function canAccess(user, patient) {
  if (user.role === 'admin' || user.role === 'staff') return true;
  if (user.role === 'doctor') return Boolean(user.doctor && patient.assignedDoctor && String(patient.assignedDoctor) === String(user.doctor));
  if (user.role === 'patient') return Boolean(user.patient && String(user.patient) === String(patient._id));
  return false;
}

async function loadAccessible(req) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw httpError(404, 'Patient not found');
  if (!canAccess(req.user, patient)) throw httpError(403, 'You do not have access to this patient');
  return patient;
}

async function checkDoctor(id) {
  if (!isId(id) || !(await Doctor.exists({ _id: id }))) throw httpError(400, 'Assigned doctor does not exist');
}

// List + search. ?q= matches patient ID, name or condition (case-insensitive)
router.get('/', async (req, res) => {
  const { role, doctor, patient } = req.user;
  const filter = {};
  if (role === 'doctor') { if (!doctor) return res.json([]); filter.assignedDoctor = doctor; }
  if (role === 'patient') { if (!patient) return res.json([]); filter._id = patient; }

  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 50)), 'i');
    filter.$or = [{ patientId: rx }, { name: rx }, { condition: rx }];
  }
  res.json(await Patient.find(filter).select('-medicalHistory -labReports').sort({ createdAt: -1 }).limit(500));
});

router.post('/', authorize('staff'), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (req.body.assignedDoctor !== undefined) { await checkDoctor(req.body.assignedDoctor); data.assignedDoctor = req.body.assignedDoctor; }
  const password = getDefaultAccountPassword();
  const patient = await createPatient(data);
  try {
    const login = await createLinkedAccount({ fullName: patient.name, role: 'patient', patient: patient._id, password });
    res.status(201).json({ ...patient.toObject(), login });
  } catch (err) {
    await patient.deleteOne().catch((cleanupError) => console.error('Patient cleanup failed after account creation error:', cleanupError));
    throw err;
  }
});

// Full record, including history and lab reports
router.get('/:id', async (req, res) => {
  const patient = await loadAccessible(req);
  await patient.populate([{ path: 'assignedDoctor', select: 'name specialization' }, { path: 'medicalHistory.doctor', select: 'name' }]);
  res.json(patient);
});

// Updating also covers "assign patient to a doctor" (assignedDoctor)
router.put('/:id', authorize('staff'), async (req, res) => {
  const update = pick(req.body, FIELDS);
  if (req.body.assignedDoctor !== undefined) { await checkDoctor(req.body.assignedDoctor); update.assignedDoctor = req.body.assignedDoctor; }
  const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-medicalHistory -labReports');
  if (!patient) throw httpError(404, 'Patient not found');
  res.json(patient);
});

router.delete('/:id', authorize(), async (req, res) => { // admin only
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) throw httpError(404, 'Patient not found');
  const users = await User.find({ patient: patient._id }).select('_id');
  if (users.length) {
    const userIds = users.map((user) => user._id);
    await User.updateMany({ _id: { $in: userIds } }, { active: false });
    await Session.updateMany({ user: { $in: userIds }, revoked: false }, { revoked: true });
  }
  res.json({ message: 'Patient deleted' });
});

// Add a diagnosis / prescription (assigned doctor, or admin)
router.post('/:id/history', authorize('doctor'), async (req, res) => {
  const patient = await loadAccessible(req);
  patient.medicalHistory.push({ ...pick(req.body, ['date', 'diagnosis', 'prescription', 'notes']), doctor: req.user.doctor, addedBy: req.user._id });
  await patient.save();
  res.status(201).json(patient.medicalHistory[patient.medicalHistory.length - 1]);
});

// Add a lab report (assigned doctor, staff or admin)
router.post('/:id/lab-reports', authorize('doctor', 'staff'), async (req, res) => {
  const patient = await loadAccessible(req);
  patient.labReports.push({ ...pick(req.body, ['date', 'testName', 'result', 'notes']), addedBy: req.user._id });
  await patient.save();
  res.status(201).json(patient.labReports[patient.labReports.length - 1]);
});

module.exports = router;
