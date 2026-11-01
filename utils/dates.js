// Day boundaries and weekdays are calculated in hospital local time (HOSPITAL_TZ_OFFSET_MINUTES)
const env = require('../config/env');

const OFFSET_MS = env.HOSPITAL_TZ_OFFSET_MINUTES * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 'YYYY-MM-DD' -> { start, end } as UTC Dates covering that local day (or null if the text is not a date)
function dayRange(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
  if (!m) return null;
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

const todayString = () => new Date(Date.now() + OFFSET_MS).toISOString().slice(0, 10);
const weekdayOf = (date) => WEEKDAYS[new Date(date.getTime() + OFFSET_MS).getUTCDay()];

module.exports = { dayRange, todayString, weekdayOf, WEEKDAYS };
