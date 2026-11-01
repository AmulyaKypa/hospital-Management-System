const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', authorize(), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await AuditLog.find().sort({ at: -1 }).limit(limit));
});

module.exports = router;
