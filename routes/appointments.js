// Appointments: patients book, doctors approve/reject/complete, admin and staff manage
const express = require('express');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { authorize } = require('../middleware/auth');
const { createBill } = require('../services/billing');
const { nextCode } = require('../services/sequence');
const { dayRange, weekdayOf } = require('../utils/dates');
const { isId } = require('../utils/ids');
const httpError = require('../utils/httpError');
const router = express.Router();

const SLOT_MS = 30 * 60 * 1000;
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
const holdsSlot = (status) => status === 'pending' || status === 'approved';

// Who sees which appointments
function scope(user) {
  if (user.role === 'admin' || user.role === 'staff') return {};
  if (user.role === 'doctor' && user.doctor) return { doctor: user.doctor };
  if (user.role === 'patient' && user.patient) return { patient: user.patient };
  return { _id: { $in: [] } }; // account not linked to a doctor/patient: nothing to show
}

// Same rules for booking and rescheduling: a real future time, on a 30-minute boundary
function checkSlot(date) {
  if (isNaN(date)) throw httpError(400, 'A valid date and time is required');
  if (date <= new Date()) throw httpError(400, 'Appointment must be in the future');
  if (date.getTime() % SLOT_MS !== 0) throw httpError(400, 'Appointments run in 30-minute slots (for example 10:00 or 10:30)');
}

function checkAvailability(doctor, date) {
  const day = weekdayOf(date);
  if (!doctor.availability.includes(day)) throw httpError(400, `${doctor.name} is not available on ${day}. Available days: ${doctor.availability.join(', ')}`);
}

function requireOwnDoctor(user) {
  if (user.role === 'doctor' && !user.doctor) throw httpError(403, 'Your login is not linked to a doctor profile');
}

router.get('/', async (req, res) => {
  const filter = scope(req.user);
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const range = dayRange(req.query.date);
  if (range) filter.date = { $gte: range.start, $lt: range.end };
  res.json(await Appointment.find(filter).populate('patient', 'name patientId').populate('doctor', 'name specialization doctorId').sort({ date: 1 }).limit(500));
});

// Book. A patient books for themselves; admin/staff book for any patient. Starts as "pending".
router.post('/', authorize('patient', 'staff'), async (req, res) => {
  let patient = req.body.patient;
  if (req.user.role === 'patient') {
    if (!req.user.patient) throw httpError(403, 'Your login is not linked to a patient record');
    patient = String(req.user.patient); // patients cannot book for someone else
  }
  const { doctor, reason } = req.body;
  const date = new Date(req.body.date);

  if (!isId(patient)) throw httpError(400, 'Patient is required');
  if (!isId(doctor)) throw httpError(400, 'Doctor is required');
  checkSlot(date);
  if (!(await Patient.exists({ _id: patient }))) throw httpError(400, 'Patient does not exist');

  const doc = await Doctor.findById(doctor);
  if (!doc) throw httpError(400, 'Doctor does not exist');
  checkAvailability(doc, date);

  try {
    res.status(201).json(await Appointment.create({ appointmentId: await nextCode('appointment', 'A'), patient, doctor, date, reason }));
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'This doctor already has an appointment at that time');
    throw err;
  }
});

// Approve (pending only) or reject (pending or approved). Only the doctor's own appointments; admin: any.
async function decide(req, res, status) {
  requireOwnDoctor(req.user);
  const from = status === 'approved' ? ['pending'] : ['pending', 'approved'];
  const filter = { _id: req.params.id, status: { $in: from } };
  if (req.user.role === 'doctor') filter.doctor = req.user.doctor;
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '';
  const appointment = await Appointment.findOneAndUpdate(filter, { status, holdsSlot: holdsSlot(status), note }, { new: true });
  if (!appointment) throw httpError(409, `Only your ${from.join(' or ')} appointments can be ${status}`);
  res.json(appointment);
}
router.post('/:id/approve', authorize('doctor'), (req, res) => decide(req, res, 'approved'));
router.post('/:id/reject', authorize('doctor'), (req, res) => decide(req, res, 'rejected'));

// Reschedule a pending or approved appointment to a new time. The doctor chose the new time, so it
// becomes (or stays) approved. The old time is kept in rescheduledFrom so the patient can see what changed.
router.post('/:id/reschedule', authorize('doctor'), async (req, res) => {
  requireOwnDoctor(req.user);
  const date = new Date(req.body.date);
  checkSlot(date);

  const filter = { _id: req.params.id, status: { $in: ['pending', 'approved'] } };
  if (req.user.role === 'doctor') filter.doctor = req.user.doctor;
  const existing = await Appointment.findOne(filter);
  if (!existing) throw httpError(409, 'Only your pending or approved appointments can be rescheduled');
  if (existing.date.getTime() === date.getTime()) throw httpError(400, 'Choose a time different from the current one');

  const doctor = await Doctor.findById(existing.doctor);
  if (!doctor) throw httpError(400, 'Doctor does not exist');
  checkAvailability(doctor, date);

  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : '';
  try {
    // Matching the old date too means a concurrent change makes this update fail instead of overwriting it
    const updated = await Appointment.findOneAndUpdate(
      { ...filter, date: existing.date },
      { date, status: 'approved', holdsSlot: true, rescheduledFrom: existing.date, note },
      { new: true }
    );
    if (!updated) throw httpError(409, 'The appointment changed in the meantime. Reload and try again.');
    res.json(updated);
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'You already have an appointment at that time');
    throw err;
  }
});

// Complete a visit (approved -> completed). Generates the consultation bill from the doctor's fee.
router.post('/:id/complete', authorize('doctor'), async (req, res) => {
  requireOwnDoctor(req.user);
  const filter = { _id: req.params.id, status: 'approved' };
  if (req.user.role === 'doctor') filter.doctor = req.user.doctor;
  const appointment = await Appointment.findOneAndUpdate(filter, { status: 'completed', holdsSlot: false }, { new: true });
  if (!appointment) throw httpError(409, 'Only your approved appointments can be completed');

  let bill = null;
  try {
    const doctor = await Doctor.findById(appointment.doctor);
    if (doctor && doctor.fee > 0) {
      bill = await createBill({
        patient: appointment.patient,
        items: [{ category: 'consultation', description: `Consultation: ${doctor.name}`, quantity: 1, unitPrice: doctor.fee }],
        createdBy: req.user._id,
      });
    }
  } catch (err) {
    // No multi-document transactions on standalone MongoDB, so undo the status change by hand
    await Appointment.updateOne({ _id: appointment._id }, { status: 'approved', holdsSlot: true }).catch(() => {});
    throw err;
  }
  res.json({ appointment, billId: bill ? bill.billId : null });
});

// Cancel (pending or approved). Patients can only cancel their own.
router.post('/:id/cancel', authorize('patient', 'staff'), async (req, res) => {
  const filter = { _id: req.params.id, status: { $in: ['pending', 'approved'] } };
  if (req.user.role === 'patient') {
    if (!req.user.patient) throw httpError(403, 'Your login is not linked to a patient record');
    filter.patient = req.user.patient;
  }
  const appointment = await Appointment.findOneAndUpdate(filter, { status: 'cancelled', holdsSlot: false }, { new: true });
  if (!appointment) throw httpError(409, 'Only pending or approved appointments can be cancelled');
  res.json(appointment);
});

module.exports = router;
