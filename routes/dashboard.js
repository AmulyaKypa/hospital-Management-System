// Role-specific dashboard numbers. Response: { stats: [{ label, value, type: 'number' | 'money' }] }
const express = require('express');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');
const { dayRange, todayString } = require('../utils/dates');
const router = express.Router();

const num = (label, value) => ({ label, value, type: 'number' });
const money = (label, value) => ({ label, value, type: 'money' });
const sumBills = (match = {}) =>
  Bill.aggregate([{ $match: match }, { $group: { _id: null, billed: { $sum: '$total' }, collected: { $sum: '$paid' } } }]).then((r) => r[0] || { billed: 0, collected: 0 });

router.get('/', async (req, res) => {
  const { role, doctor, patient } = req.user;
  const today = dayRange(todayString());
  const now = new Date();
  const active = { $in: ['pending', 'approved'] };

  if (role === 'doctor') {
    if (!doctor) return res.json({ stats: [] });
    const [mine, pending, todays, upcoming] = await Promise.all([
      Patient.countDocuments({ assignedDoctor: doctor }),
      Appointment.countDocuments({ doctor, status: 'pending' }),
      Appointment.countDocuments({ doctor, status: active, date: { $gte: today.start, $lt: today.end } }),
      Appointment.countDocuments({ doctor, status: 'approved', date: { $gte: now } }),
    ]);
    return res.json({ stats: [num('My patients', mine), num('Awaiting my approval', pending), num('Appointments today', todays), num('Upcoming approved', upcoming)] });
  }

  if (role === 'patient') {
    if (!patient) return res.json({ stats: [] });
    const [record, upcoming, bills] = await Promise.all([
      Patient.findById(patient).select('medicalHistory'),
      Appointment.countDocuments({ patient, status: active, date: { $gte: now } }),
      sumBills({ patient }),
    ]);
    const prescriptions = record ? record.medicalHistory.filter((h) => h.prescription).length : 0;
    return res.json({ stats: [num('Upcoming appointments', upcoming), num('Prescriptions on file', prescriptions), money('Balance due', bills.billed - bills.collected)] });
  }

  // admin and staff: hospital-wide statistics
  const [patients, doctors, todays, pending, bills] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments(),
    Appointment.countDocuments({ status: active, date: { $gte: today.start, $lt: today.end } }),
    Appointment.countDocuments({ status: 'pending' }),
    sumBills(),
  ]);
  res.json({
    stats: [
      num('Patients', patients), num('Doctors', doctors), num('Appointments today', todays), num('Pending approvals', pending),
      money('Revenue collected', bills.collected), money('Total billed', bills.billed), money('Outstanding', bills.billed - bills.collected),
    ],
  });
});

module.exports = router;
