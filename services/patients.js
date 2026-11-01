const Patient = require('../models/Patient');
const { nextCode } = require('./sequence');

async function createPatient(data) {
  await new Patient({ ...data, patientId: 'TEMP' }).validate(); // validate first so failed requests don't burn IDs
  return Patient.create({ ...data, patientId: await nextCode('patient', 'P') });
}

module.exports = { createPatient };
