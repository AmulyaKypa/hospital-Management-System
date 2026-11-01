const mongoose = require('mongoose');
const { contactPattern, wholeNumber } = require('../utils/validators');

const doctorSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, unique: true, immutable: true }, // D001, D002, ...
    name: { type: String, required: [true, 'Name is required'], trim: true },
    specialization: { type: String, required: [true, 'Specialization is required'], trim: true },
    contact: { type: String, required: [true, 'Contact is required'], match: contactPattern },
    fee: { type: Number, default: 0, min: 0, validate: wholeNumber }, // consultation fee in paise
    availability: {
      type: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      validate: { validator: (a) => a.length > 0, message: 'Select at least one available day' },
    },
    // A doctor's appointments are not stored here: they are found through Appointment.doctor (no duplicated data to keep in sync)
  },
  { timestamps: true }
);

doctorSchema.index({ specialization: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
