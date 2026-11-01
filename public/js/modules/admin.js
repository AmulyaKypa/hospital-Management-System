// Administration: logins, session revocation, audit trail (admin only)
registerModule({
  id: 'admin', title: 'Administration', roles: [],
  render: async function renderAdmin(view) {
    const [users, audit, doctors, patients] = await Promise.all([api('/users'), api('/audit?limit=100'), api('/doctors'), api('/patients')]);
    const refresh = () => renderAdmin(view);

    const form = buildForm({
      title: 'Create login', submitText: 'Create login',
      fields: [
        { name: 'username', label: 'Username', required: true },
        { name: 'fullName', label: 'Full name', required: true },
        { name: 'role', label: 'Role', type: 'select', required: true, options: ['admin', 'staff', 'doctor', 'patient'].map((r) => ({ value: r, label: r })) },
        { name: 'password', label: 'Password (min 8 characters)', type: 'password', required: true },
        { name: 'doctor', label: 'Doctor profile (for role doctor)', type: 'select', placeholder: 'Not applicable', options: opts(doctors, dname) },
        { name: 'patient', label: 'Patient record (for role patient)', type: 'select', placeholder: 'Not applicable', options: opts(patients, pname) },
      ],
      async onSubmit(values) { await api('/users', 'POST', values); showMessage('Login created.'); await refresh(); },
    });

    const usersTable = card('Logins', table(
      [{ label: 'Username', get: (u) => u.username }, { label: 'Name', get: (u) => u.fullName }, { label: 'Role', get: (u) => u.role }, { label: 'Active', get: (u) => (u.active ? 'yes' : 'no') }],
      users,
      (u) => [
        btn(u.active ? 'Deactivate' : 'Activate', async () => { await api('/users/' + u.id, 'PATCH', { active: !u.active }); showMessage('User updated.'); await refresh(); }, 'secondary'),
        btn('Sign out everywhere', async () => { const r = await api(`/users/${u.id}/revoke-sessions`, 'POST'); showMessage(r.message); }, 'secondary'),
        btn('Reset password', async () => {
          const password = prompt('New password for ' + u.username + ' (min 8 characters):');
          if (!password) return;
          await api('/users/' + u.id, 'PATCH', { password });
          showMessage('Password changed and sessions revoked.');
        }, 'secondary'),
      ]
    ));

    const auditTable = card('Audit trail (latest 100 changes and failed requests)', table(
      [
        { label: 'Time', get: (a) => fmtDate(a.at) }, { label: 'User', get: (a) => a.username || '-' }, { label: 'Role', get: (a) => a.role || '-' },
        { label: 'Action', get: (a) => `${a.method} ${a.path}` }, { label: 'Result', get: (a) => a.status },
      ],
      audit, null, 'No audit entries.'
    ));

    view.replaceChildren(form.el, usersTable, auditTable);
  },
});
