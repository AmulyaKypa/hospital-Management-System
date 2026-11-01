const httpError = require('./httpError');

exports.checkPassword = (p) => {
  if (typeof p !== 'string' || p.length < 8) throw httpError(400, 'Password must be at least 8 characters');
};
exports.checkUsername = (u) => {
  if (typeof u !== 'string' || !/^[a-zA-Z0-9._-]{3,30}$/.test(u.trim())) {
    throw httpError(400, 'Username must be 3-30 characters (letters, numbers, . _ -)');
  }
};
