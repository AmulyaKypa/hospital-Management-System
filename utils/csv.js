// Builds CSV text. Cells starting with = + - @ get a leading quote so spreadsheets don't run them as formulas.
const cell = (value) => {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

module.exports = (headers, rows) => '\uFEFF' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
