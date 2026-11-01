// Copy only the listed keys from an object (whitelisting stops clients setting fields like "mrn" or "role")
module.exports = (obj, keys) =>
  keys.reduce((out, k) => (obj[k] !== undefined ? ((out[k] = obj[k]), out) : out), {});
