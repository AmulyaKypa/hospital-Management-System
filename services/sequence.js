const mongoose = require('mongoose');

const Counter = mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

// Atomic increment: two simultaneous requests can never receive the same number
async function nextSequence(name) {
  const counter = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return counter.seq;
}

// nextCode('patient', 'P') -> 'P001', 'P002', ...
async function nextCode(name, prefix) {
  return prefix + String(await nextSequence(name)).padStart(3, '0');
}

module.exports = { nextSequence, nextCode };
