// Builds the Express app (kept separate from server.js so it can be tested without a database)
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('./middleware/auth');
const audit = require('./middleware/audit');
const sanitize = require('./middleware/sanitize');
const errorHandler = require('./middleware/error');

const app = express();

// Hardened headers (CSP, X-Frame-Options, nosniff, ...). The frontend uses no inline scripts, so the strict default CSP works.
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { req.body ??= {}; next(); });
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Everything under /api: rate limit -> audit trail -> NoSQL-injection filter
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
app.use('/api', audit);
app.use('/api', sanitize);

app.use('/api/auth', require('./routes/auth'));
// Every route below requires a valid session; each router then applies its own role checks
app.use('/api/users', authenticate, require('./routes/users'));
app.use('/api/audit', authenticate, require('./routes/audit'));
app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
app.use('/api/patients', authenticate, require('./routes/patients'));
app.use('/api/doctors', authenticate, require('./routes/doctors'));
app.use('/api/appointments', authenticate, require('./routes/appointments'));
app.use('/api/bills', authenticate, require('./routes/bills'));
app.use('/api/reports', authenticate, require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
