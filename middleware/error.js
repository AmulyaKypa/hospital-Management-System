// Central error handler: turns errors into clean JSON responses
module.exports = (err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID or value' });
  if (err.code === 11000) return res.status(409).json({ error: 'That record already exists (duplicate value)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
};
