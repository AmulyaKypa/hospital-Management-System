// Billing: generate bills (consultation / treatment / test), record payments, track payment status
const express = require('express');
const Bill = require('../models/Bill');
const Patient = require('../models/Patient');
const { authorize } = require('../middleware/auth');
const { createBill } = require('../services/billing');
const { isId } = require('../utils/ids');
const httpError = require('../utils/httpError');
const router = express.Router();

router.get('/', authorize('staff', 'patient'), async (req, res) => {
  const filter = {};
  if (req.user.role === 'patient') {
    if (!req.user.patient) return res.json([]);
    filter.patient = req.user.patient; // patients only ever see their own bills
  } else if (isId(req.query.patient)) {
    filter.patient = req.query.patient;
  }
  if (['unpaid', 'partial', 'paid'].includes(req.query.status)) filter.status = req.query.status;
  res.json(await Bill.find(filter).populate('patient', 'name patientId').sort({ createdAt: -1 }).limit(300));
});

router.get('/:id', authorize('staff', 'patient'), async (req, res) => {
  const bill = await Bill.findById(req.params.id).populate('patient', 'name patientId');
  if (!bill) throw httpError(404, 'Bill not found');
  if (req.user.role === 'patient' && String(bill.patient._id) !== String(req.user.patient)) throw httpError(403, 'This is not your bill');
  res.json(bill);
});

router.post('/', authorize('staff'), async (req, res) => {
  if (!isId(req.body.patient)) throw httpError(400, 'Patient is required');
  if (!(await Patient.exists({ _id: req.body.patient }))) throw httpError(400, 'Patient does not exist');
  res.status(201).json(await createBill({ patient: req.body.patient, items: req.body.items, createdBy: req.user._id }));
});

router.post('/:id/pay', authorize('staff'), async (req, res) => {
  const amount = req.body.amount;
  if (!Number.isInteger(amount) || amount < 1) throw httpError(400, 'Amount must be a whole number of paise (at least 1)');

  // Atomic: "a payment may not exceed the balance" is part of the update filter
  const bill = await Bill.findOneAndUpdate(
    { _id: req.params.id, $expr: { $lte: [{ $add: ['$paid', amount] }, '$total'] } },
    { $inc: { paid: amount }, $push: { payments: { amount, by: req.user._id } } },
    { new: true }
  );
  if (!bill) throw httpError(409, 'Bill not found, or the payment is more than the outstanding balance');

  // Payment status is recalculated from the CURRENT amounts, so concurrent payments can't leave it stale
  await Bill.updateOne({ _id: bill._id, $expr: { $eq: ['$paid', '$total'] } }, { status: 'paid' });
  await Bill.updateOne({ _id: bill._id, paid: { $gt: 0 }, $expr: { $lt: ['$paid', '$total'] } }, { status: 'partial' });
  res.json(await Bill.findById(bill._id).populate('patient', 'name patientId'));
});

module.exports = router;
