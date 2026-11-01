// Small UI toolkit shared by every page. Everything is built with DOM methods and textContent
// (never innerHTML), so data from the server can't inject HTML or scripts (XSS).

const MODULES = [];
const registerModule = (m) => MODULES.push(m);
const CURRENCY = '\u20B9'; // change to '$' etc. if needed. Amounts are stored as integers (paise/cents).

// el('div', {class:'x', onclick: fn}, child, 'text') -> HTMLElement
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  children.flat().forEach((c) => {
    if (c === false || c == null) return;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return node;
}

const money = (paise) => CURRENCY + (paise / 100).toFixed(2);
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '-');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString() : '-');
const pname = (p) => (p ? `${p.name} (${p.patientId})` : '(deleted patient)');
const dname = (d) => (d ? `${d.name} (${d.specialization})` : '(deleted doctor)');
const field = (label, value) => el('div', { class: 'kv' }, el('span', { text: label }), el('strong', { text: value || '-' }));
const opts = (items, label) => items.map((i) => ({ value: i._id, label: label(i) }));
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_BY_GETDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // index = Date.getDay()
const badge = (status) => el('span', { class: 'badge ' + status, text: status });
const CONTACT_PATTERN = /^[0-9+\-\s]{7,15}$/; // same rule as the server

let messageTimer;
function showMessage(text, type = 'ok') {
  const box = document.getElementById('message');
  box.textContent = text;
  box.className = type;
  box.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (box.hidden = true), 5000);
}

// Button whose click handler reports errors instead of failing silently
function btn(text, onClick, cls = '') {
  return el('button', {
    type: 'button',
    class: ('small ' + cls).trim(),
    text,
    onclick: async (e) => {
      try { await onClick(e); } catch (err) { showMessage(err.message, 'error'); }
    },
  });
}

// Table: columns = [{label, get: row => value}], actions = row => [buttons]
function table(columns, rows, actions, emptyText = 'Nothing here yet.') {
  const head = el('tr', {}, columns.map((c) => el('th', { text: c.label })), actions && el('th'));
  const body = el('tbody');
  if (!rows.length) {
    body.append(el('tr', {}, el('td', { class: 'empty', colspan: columns.length + (actions ? 1 : 0), text: emptyText })));
  }
  for (const row of rows) {
    const tr = el('tr', {}, columns.map((c) => {
      const v = c.get(row);
      return v instanceof Node ? el('td', {}, v) : el('td', { text: String(v ?? '-') });
    }));
    if (actions) tr.append(el('td', { class: 'row-actions' }, actions(row)));
    body.append(tr);
  }
  return el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, head), body));
}

const card = (title, ...children) => el('section', { class: 'card' }, title && el('h2', { text: title }), children);
const credentialsCard = ({ username, password }) => card('Login credentials — share securely', el('p', {}, 'Username: ', el('strong', { text: username })), el('p', {}, 'Default password: ', el('strong', { text: password })), el('p', { class: 'muted', text: 'Ask the user to change the password after signing in.' }));

// Form builder. fields = [{name, label, type, required, options, min, max, step, pattern, placeholder}]
// types: text | number | money | date | datetime-local | password | select | textarea
// 'money' fields are typed in rupees and delivered to onSubmit as integer paise.
// Empty optional fields are left out of the values object.
function buildForm({ title, fields, submitText = 'Save', onSubmit }) {
  const form = el('form', { class: 'card form-grid', novalidate: true });
  const heading = el('h2', { text: title || '' });
  if (title) form.append(heading);

  const inputs = {};
  const wrappers = {};
  for (const f of fields) {
    let input;
    if (f.type === 'checkboxes') {
      input = el('div', { class: 'checks' }, f.options.map((o) => el('label', { class: 'check' },
        el('input', { type: 'checkbox', value: o.value, checked: (f.default || []).includes(o.value) }), o.label)));
    } else if (f.type === 'select') {
      input = el('select', {}, el('option', { value: '', text: f.placeholder || 'Select...' }),
        (f.options || []).map((o) => el('option', { value: o.value, text: o.label })));
    } else if (f.type === 'textarea') {
      input = el('textarea', { rows: 3, placeholder: f.placeholder });
    } else {
      input = el('input', {
        type: f.type === 'money' ? 'number' : f.type || 'text',
        min: f.min, max: f.max, placeholder: f.placeholder,
        step: f.step || (f.type === 'money' ? '0.01' : null),
        autocomplete: f.type === 'password' ? 'new-password' : 'off',
      });
    }
    input.addEventListener('input', () => input.classList.remove('invalid'));
    inputs[f.name] = input;
    const wrapper = f.type === 'checkboxes'
      ? el('div', { class: 'group wide' }, el('span', { text: f.label }), input)
      : el('label', { class: f.type === 'textarea' ? 'wide' : '' }, f.label, input);
    wrappers[f.name] = wrapper;
    form.append(wrapper);
  }

  const submit = el('button', { type: 'submit', text: submitText });
  const actions = el('div', { class: 'actions' }, submit);
  form.append(actions);

  const api = {
    el: form, title: heading, submit, actions, inputs, wrappers,
    set(values) {
      for (const [k, v] of Object.entries(values)) {
        if (!inputs[k]) continue;
        if (inputs[k].classList.contains('checks')) inputs[k].querySelectorAll('input').forEach((box) => (box.checked = (v || []).includes(box.value)));
        else inputs[k].value = v ?? '';
      }
    },
    reset() { form.reset(); Object.values(inputs).forEach((i) => i.classList.remove('invalid')); },
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    let valid = true;
    for (const f of fields) {
      const input = inputs[f.name];
      if (f.type === 'checkboxes') {
        const picked = [...input.querySelectorAll('input:checked')].map((b) => b.value);
        input.classList.toggle('invalid', Boolean(f.required) && !picked.length);
        if (f.required && !picked.length) valid = false; else values[f.name] = picked;
        continue;
      }
      const raw = input.value.trim();
      let bad = f.required && !raw;
      if (raw && (f.type === 'number' || f.type === 'money')) {
        const n = Number(raw);
        bad = Number.isNaN(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max);
      }
      if (raw && f.pattern && !f.pattern.test(raw)) bad = true;
      input.classList.toggle('invalid', Boolean(bad));
      if (bad) { valid = false; continue; }
      if (raw) values[f.name] = convert(f, raw);
    }
    if (!valid) return showMessage('Please correct the highlighted fields.', 'error');
    try { await onSubmit(values, api); } catch (err) { showMessage(err.message, 'error'); }
  });
  return api;
}

function convert(field, raw) {
  if (field.type === 'number') return Number(raw);
  if (field.type === 'money') return Math.round(Number(raw) * 100);
  if (field.type === 'datetime-local') return new Date(raw).toISOString();
  return raw;
}
