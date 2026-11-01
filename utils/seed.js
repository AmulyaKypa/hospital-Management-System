// Runs at startup: creates the first admin, and (if SEED_DEMO=true) demo logins and sample data
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const { nextCode } = require('../services/sequence');
const { createPatient } = require('../services/patients');

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DEMO_DOCTORS = [
  { username: 'doctor1', name: 'Dr. Meera Rao', specialization: 'General Medicine', contact: '9000000001', fee: 50000, availability: WEEK },
  { username: 'doctor2', name: 'Dr. Arjun Nair', specialization: 'Cardiology', contact: '9000000002', fee: 80000, availability: ['Mon', 'Wed', 'Fri'] },
  { username: 'doctor3', name: 'Dr. Sunita Reddy', specialization: 'Pediatrics', contact: '9000000003', fee: 60000, availability: [...WEEK, 'Sat'] },
  { username: 'doctor4', name: 'Dr. Vikram Singh', specialization: 'Orthopedics', contact: '9000000004', fee: 70000, availability: ['Tue', 'Thu', 'Sat'] },
  { username: 'doctor5', name: 'Dr. Ananya Iyer', specialization: 'Dermatology', contact: '9000000005', fee: 60000, availability: ['Mon', 'Tue', 'Thu'] },
  { username: 'doctor6', name: 'Dr. Farah Khan', specialization: 'Gynecology', contact: '9000000006', fee: 70000, availability: ['Mon', 'Wed', 'Thu', 'Fri'] },
  { username: 'doctor7', name: 'Dr. Rohan Mehta', specialization: 'Neurology', contact: '9000000007', fee: 90000, availability: ['Tue', 'Wed', 'Fri'] },
  { username: 'doctor8', name: 'Dr. Priya Sharma', specialization: 'ENT', contact: '9000000008', fee: 55000, availability: WEEK },
];

async function seed() {
  if (!(await User.exists({ role: 'admin' }))) {
    await User.create({
      username: env.ADMIN_USERNAME, fullName: 'System Administrator', role: 'admin',
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
    });
    console.log(`Created admin user "${env.ADMIN_USERNAME}". Change this password after your first login.`);
  }
  if (!env.SEED_DEMO) return;

  const passwordHash = await bcrypt.hash('Demo@12345', 10);
  const addUser = (username, fullName, role, links = {}) =>
    User.updateOne({ username }, { $setOnInsert: { fullName, role, passwordHash, active: true, ...links } }, { upsert: true });

  await addUser('staff1', 'Demo Staff', 'staff');

  // Demo doctors, each with a login (doctor1 ... doctor8). Safe to run again: existing doctors are reused by name.
  for (const { username, ...profile } of DEMO_DOCTORS) {
    const doctor = (await Doctor.findOne({ name: profile.name })) || (await Doctor.create({ ...profile, doctorId: await nextCode('doctor', 'D') }));
    await addUser(username, doctor.name, 'doctor', { doctor: doctor._id });
  }

  const meera = await Doctor.findOne({ name: 'Dr. Meera Rao' });
  if (meera && !(await Patient.exists({}))) {
    const ravi = await createPatient({ name: 'Ravi Kumar', age: 45, gender: 'male', contact: '9876543210', condition: 'Type 2 diabetes', assignedDoctor: meera._id });
    await Patient.updateOne({ _id: ravi._id }, { $push: {
      medicalHistory: { diagnosis: 'Type 2 diabetes', prescription: 'Metformin 500mg twice daily', notes: 'Review in 3 months', doctor: meera._id },
      labReports: { testName: 'HbA1c', result: '7.2 %', notes: 'Slightly above target' },
    } });
    await addUser('patient1', ravi.name, 'patient', { patient: ravi._id });
  }
}

module.exports = seed;
