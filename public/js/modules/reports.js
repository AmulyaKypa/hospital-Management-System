// Report exports (CSV files that open in Excel or Google Sheets)
registerModule({
  id: 'reports', title: 'Reports', roles: ['staff'],
  render: async function renderReports(view) {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); // browser-local date
    const date = el('input', { type: 'date', value: today });
    const row = (title, text, control, button) => card(title, el('p', { class: 'muted', text }), el('div', { class: 'actions' }, control, button));

    view.replaceChildren(
      row('Daily appointments', 'All appointments on the chosen day, with status.', date,
        btn('Download CSV', () => download('/reports/appointments.csv?date=' + date.value, `appointments-${date.value}.csv`))),
      row('Patient records', 'Every patient with contact details, condition and assigned doctor.', null,
        btn('Download CSV', () => download('/reports/patients.csv', 'patient-records.csv'))),
      row('Billing and revenue', 'Every bill with total, amount paid, balance and payment status.', null,
        btn('Download CSV', () => download('/reports/bills.csv', 'billing-report.csv')))
    );
  },
});
