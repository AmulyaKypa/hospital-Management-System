// All settings come from environment variables, with safe development defaults
const crypto = require('crypto');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set when NODE_ENV=production');
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hms',
  // Development fallback is random per start, so tokens stop working after a restart
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  IDLE_MINUTES: Number(process.env.IDLE_MINUTES) || 15,   // inactivity logout
  TOKEN_HOURS: Number(process.env.TOKEN_HOURS) || 8,      // absolute session lifetime
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@12345',
  DEFAULT_ACCOUNT_PASSWORD: process.env.DEFAULT_ACCOUNT_PASSWORD,
  // Hospital local time as minutes from UTC (330 = India, 0 = UTC). Used for weekdays and "today".
  HOSPITAL_TZ_OFFSET_MINUTES: Number(process.env.HOSPITAL_TZ_OFFSET_MINUTES) || 0,
  SEED_DEMO: process.env.SEED_DEMO === 'true',            // demo users, doctors, beds, medicines
};
