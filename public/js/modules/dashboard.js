// Dashboard: numbers depend on the role (hospital statistics for admin/staff, own workload for doctors, own summary for patients)
registerModule({
  id: 'dashboard', title: 'Dashboard', roles: ['*'],
  render: async function renderDashboard(view) {
    const { stats } = await api('/dashboard');
    view.replaceChildren(el('div', { class: 'stats' }, stats.map((s) =>
      el('div', { class: 'stat' }, el('strong', { text: s.type === 'money' ? money(s.value) : String(s.value) }), el('span', { text: s.label })))));
  },
});
