const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, required: true, unique: true, immutable: true }, // A001, A002, ...
    patient: { type: ObjectId, ref: 'Patient', required: [true, 'Patient is required'] },
    doctor: { type: ObjectId, ref: 'Doctor', required: [true, 'Doctor is required'] },
    date: { type: Date, required: [true, 'Date and time are required'] },
    reason: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'], default: 'pending' },
    holdsSlot: { type: Boolean, default: true }, // true while pending or approved
    note: { type: String, trim: true, default: '' }, // doctor's note when rejecting or rescheduling
    rescheduledFrom: Date,                           // previous time, set when a doctor reschedules
  },
  { timestamps: true }
);

// A doctor can have only ONE pending/approved appointment per slot. MongoDB enforces it, so two
// simultaneous bookings cannot both succeed. Rejected, cancelled and completed ones free the slot.
appointmentSchema.index({ doctor: 1, date: 1 }, { unique: true, partialFilterExpression: { holdsSlot: true } });
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ date: 1 });
appointmentSchema.index({ status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
