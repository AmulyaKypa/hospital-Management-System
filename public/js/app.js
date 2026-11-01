// App shell: validates the session, builds the menu for the user's role, routes by URL hash, auto-logout when idle
async function start() {
  if (!Auth.token) { location.href = '/login.html'; return; }

  const { user, idleMinutes } = await api('/auth/me'); // 401 here sends us to the login page
  Auth.save(Auth.token, user);
  document.getElementById('whoami').textContent = `${user.fullName} (${user.role})`;

  // The menu only hides what a role can't use. The SERVER enforces permissions on every request.
  // (admin sees everything except pages that only make sense for one role, like a patient's own record)
  const allowed = MODULES.filter((m) => (user.role === 'admin' ? !m.only : m.roles.includes('*') || m.roles.includes(user.role)));
  const nav = document.getElementById('nav');
  allowed.forEach((m) => nav.append(el('a', { href: '#' + m.id, 'data-id': m.id, text: m.title })));

  async function show() {
    const module = allowed.find((m) => '#' + m.id === location.hash) || allowed[0];
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === module.id));
    document.getElementById('page-title').textContent = module.title;
    const view = document.getElementById('view');
    view.replaceChildren(el('p', { class: 'muted', text: 'Loading...' }));
    try { await module.render(view); } catch (err) { showMessage(err.message, 'error'); view.replaceChildren(); }
  }
  window.addEventListener('hashchange', show);
  await show();

  // Inactivity logout
  const idleMs = idleMinutes * 60 * 1000;
  let idleTimer;
  const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(signOut, idleMs); };
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();
}

async function signOut() {
  try { await api('/auth/logout', 'POST'); } catch { /* already signed out */ }
  Auth.clear();
  location.href = '/login.html';
}

document.getElementById('logout').addEventListener('click', signOut);
start().catch((err) => showMessage(err.message, 'error'));
