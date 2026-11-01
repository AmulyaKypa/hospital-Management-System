if (Auth.token) location.href = '/';
if (new URLSearchParams(location.search).get('expired')) showMessage('You were signed out. Please sign in again.', 'error');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

async function signIn(username, password, role) {
  const { token, user } = await api('/auth/login', 'POST', { username, password, role });
  Auth.save(token, user);
  location.href = '/';
}

document.getElementById('show-register').addEventListener('click', () => {
  loginForm.hidden = true;
  registerForm.hidden = false;
  document.getElementById('register-name').focus();
});
document.getElementById('show-login').addEventListener('click', () => {
  registerForm.hidden = true;
  loginForm.hidden = false;
  document.getElementById('username').focus();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('role').value;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!role) return showMessage('Choose whether you are a patient, doctor, staff member or admin.', 'error');
  if (!username || !password) return showMessage('Enter your username and password.', 'error');
  try { await signIn(username, password, role); } catch (err) { showMessage(err.message, 'error'); }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ageValue = document.getElementById('register-age').value;
  const age = Number(ageValue);
  const data = {
    fullName: document.getElementById('register-name').value.trim(),
    username: document.getElementById('register-username').value.trim(),
    password: document.getElementById('register-password').value,
    age,
    gender: document.getElementById('register-gender').value,
    contact: document.getElementById('register-contact').value.trim(),
    address: document.getElementById('register-address').value.trim(),
  };
  if (!data.fullName || !data.username || !data.password || !data.gender || !data.contact || !ageValue || !Number.isInteger(age)) {
    return showMessage('Complete all required fields with a valid age.', 'error');
  }
  try {
    const result = await api('/auth/register', 'POST', data);
    document.getElementById('register-password').value = '';
    document.getElementById('username').value = data.username;
    document.getElementById('password').value = '';
    document.getElementById('role').value = 'patient';
    registerForm.hidden = true;
    loginForm.hidden = false;
    showMessage(result.message, 'ok');
  } catch (err) {
    showMessage(err.message, 'error');
  }
});
