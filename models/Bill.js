const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { wholeNumber } = require('../utils/validators');

const itemSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ['consultation', 'treatment', 'test', 'other'], required: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: wholeNumber },
    unitPrice: { type: Number, required: true, min: 0, validate: wholeNumber }, // paise
    amount: { type: Number, required: true, min: 0, validate: wholeNumber },    // quantity x unitPrice
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billId: { type: String, required: true, unique: true, immutable: true }, // B001, B002, ...
    patient: { type: ObjectId, ref: 'Patient', required: true },
    items: { type: [itemSchema], validate: { validator: (a) => a.length > 0, message: 'A bill needs at least one item' } },
    total: { type: Number, required: true, min: 0, validate: wholeNumber },   // all money is stored as whole paise
    paid: { type: Number, default: 0, min: 0, validate: wholeNumber },
    status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    payments: [{ amount: Number, at: { type: Date, default: Date.now }, by: { type: ObjectId, ref: 'User' }, _id: false }],
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

billSchema.index({ patient: 1, createdAt: -1 });
billSchema.index({ status: 1 });

module.exports = mongoose.model('Bill', billSchema);
