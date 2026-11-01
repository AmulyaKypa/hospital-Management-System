// Session storage + fetch wrapper. The token lives in sessionStorage, so closing the tab signs you out.
// (Security rests on the server: role checks, session revocation and inactivity timeout all happen there.)
const Auth = {
  get token() { return sessionStorage.getItem('hms_token'); },
  get user() { try { return JSON.parse(sessionStorage.getItem('hms_user')); } catch { return null; } },
  save(token, user) { sessionStorage.setItem('hms_token', token); sessionStorage.setItem('hms_user', JSON.stringify(user)); },
  clear() { sessionStorage.removeItem('hms_token'); sessionStorage.removeItem('hms_user'); },
};

async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;

  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Server did not return JSON. Open the app at http://localhost:3000 and make sure the server is running.');
  }

  // Expired, revoked or idle session: go back to the sign-in page
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    Auth.clear();
    location.href = '/login.html?expired=1';
    throw new Error(data.error || 'Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Downloads a file from the API (the Authorization header is needed, so a plain link would not work)
async function download(path, filename) {
  const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + Auth.token } });
  if (res.status === 401) { Auth.clear(); location.href = '/login.html?expired=1'; return; }
  if (!res.ok) {
    let message = 'Download failed';
    try { message = (await res.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
