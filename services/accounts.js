const bcrypt = require('bcryptjs');
const User = require('../models/User');
const env = require('../config/env');
const httpError = require('../utils/httpError');
const { checkPassword } = require('../utils/password');

function getDefaultAccountPassword() {
  if (!env.DEFAULT_ACCOUNT_PASSWORD) {
    throw httpError(503, 'Account creation is not configured. Set DEFAULT_ACCOUNT_PASSWORD on the server.');
  }
  checkPassword(env.DEFAULT_ACCOUNT_PASSWORD);
  return env.DEFAULT_ACCOUNT_PASSWORD;
}

function getNameBase(fullName, role) {
  const parts = fullName.trim().split(/\s+/);
  if (role === 'doctor' && /^dr\.?$/i.test(parts[0])) parts.shift();
  return (parts[0] || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30);
}

async function createLinkedAccount({ fullName, role, patient, doctor, password }) {
  const base = getNameBase(fullName, role);
  if (!base) throw httpError(400, 'Could not generate a username from the name');
  const passwordHash = await bcrypt.hash(password, 10);

  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const tail = suffix === 1 && base.length >= 3 ? '' : String(suffix === 1 ? 1 : suffix);
    const username = base.slice(0, 30 - tail.length) + tail;
    if (await User.exists({ username })) continue;

    try {
      await User.create({
        username, fullName, role, patient, doctor, passwordHash,
      });
      return { username, password };
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  throw httpError(409, 'Could not generate an available username for this name');
}

module.exports = { createLinkedAccount, getDefaultAccountPassword };
