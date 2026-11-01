// CSV exports (admin and staff)
const express = require('express');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const { authorize } = require('../middleware/auth');
const toCsv = require('../utils/csv');
const { dayRange, todayString } = require('../utils/dates');
const httpError = require('../utils/httpError');
const router = express.Router();

router.use(authorize('staff'));

const send = (res, filename, csv) =>
  res.type('text/csv').set('Content-Disposition', `attachment; filename="${filename}"`).send(csv);

// Daily appointments: ?date=YYYY-MM-DD (defaults to today)
router.get('/appointments.csv', async (req, res) => {
  const date = req.query.date || todayString();
  const range = dayRange(date);
  if (!range) throw httpError(400, 'Date must look like 2026-10-31');
  const rows = await Appointment.find({ date: { $gte: range.start, $lt: range.end } })
    .populate('patient', 'name patientId').populate('doctor', 'name specialization').sort({ date: 1 });
  send(res, `appointments-${date}.csv`, toCsv(
    ['Appointment ID', 'Date and time (UTC)', 'Patient ID', 'Patient', 'Doctor', 'Specialization', 'Status', 'Reason'],
    rows.map((a) => [a.appointmentId, a.date.toISOString(), a.patient?.patientId, a.patient?.name, a.doctor?.name, a.doctor?.specialization, a.status, a.reason])
  ));
});

router.get('/patients.csv', async (req, res) => {
  const rows = await Patient.find().select('-medicalHistory -labReports').populate('assignedDoctor', 'name').sort({ patientId: 1 });
  send(res, 'patient-records.csv', toCsv(
    ['Patient ID', 'Name', 'Age', 'Gender', 'Contact', 'Address', 'Blood group', 'Allergies', 'Condition', 'Assigned doctor', 'Registered on'],
    rows.map((p) => [p.patientId, p.name, p.age, p.gender, p.contact, p.address, p.bloodGroup, p.allergies, p.condition, p.assignedDoctor?.name, p.createdAt.toISOString().slice(0, 10)])
  ));
});

// Revenue report. Amounts are exported in rupees (paise / 100).
router.get('/bills.csv', async (req, res) => {
  const rows = await Bill.find().populate('patient', 'name patientId').sort({ createdAt: -1 });
  const rupees = (paise) => (paise / 100).toFixed(2);
  send(res, 'billing-report.csv', toCsv(
    ['Bill ID', 'Created on', 'Patient ID', 'Patient', 'Items', 'Total', 'Paid', 'Balance', 'Status'],
    rows.map((b) => [b.billId, b.createdAt.toISOString().slice(0, 10), b.patient?.patientId, b.patient?.name, b.items.map((i) => `${i.category}: ${i.description}`).join('; '), rupees(b.total), rupees(b.paid), rupees(b.total - b.paid), b.status])
  ));
});

module.exports = router;
