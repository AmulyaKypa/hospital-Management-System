// Blocks NoSQL operator injection such as {"username": {"$ne": ""}}:
// no key anywhere in the body or query string may start with "$" or contain "."
function unsafe(value) {
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || unsafe(inner)) return true;
    }
  }
  return false;
}

module.exports = (req, res, next) =>
  unsafe(req.body) || unsafe(req.query) ? res.status(400).json({ error: 'Invalid characters in request' }) : next();
