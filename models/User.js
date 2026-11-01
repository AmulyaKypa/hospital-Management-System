const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3 },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false }, // never returned by default
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },   // set for role 'doctor'
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }, // set for role 'patient'
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return { id: this.id, username: this.username, fullName: this.fullName, role: this.role, active: this.active, doctor: this.doctor ? String(this.doctor) : null, patient: this.patient ? String(this.patient) : null };
};

module.exports = mongoose.model('User', userSchema);
