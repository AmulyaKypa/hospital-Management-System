// Appointments: patients book, doctors approve/reject/reschedule/complete, admin and staff manage everything
registerModule({
  id: 'appointments', title: 'Appointments', roles: ['*'],
  render: async function renderAppointments(view) {
    const role = Auth.user.role;
    const manager = role === 'admin' || role === 'staff';
    const [doctors, patients] = await Promise.all([api('/doctors'), manager ? api('/patients') : []]);

    const statusFilter = el('select', { onchange: () => load() },
      el('option', { value: '', text: 'All statuses' }),
      ['pending', 'approved', 'rejected', 'cancelled', 'completed'].map((s) => el('option', { value: s, text: s })));
    const dateFilter = el('input', { type: 'date', onchange: () => load() });
    const holder = el('div');
    const rescheduleHolder = el('div');

    // Doctor (or admin) picks a new time for a pending or approved appointment
    function openReschedule(a) {
      const doctor = doctors.find((d) => a.doctor && d._id === a.doctor._id);
      const f = buildForm({
        title: `Reschedule ${a.appointmentId} (${a.patient ? a.patient.name : 'patient'}, currently ${fmtDate(a.date)})`,
        submitText: 'Reschedule',
        fields: [
          { name: 'date', label: `New date and time (30-minute slots; available: ${doctor ? doctor.availability.join(', ') : '-'})`, type: 'datetime-local', step: 1800, required: true },
          { name: 'note', label: 'Message for the patient (optional)' },
        ],
        async onSubmit(values) {
          const day = WEEKDAY_BY_GETDAY[new Date(values.date).getDay()];
          if (doctor && !doctor.availability.includes(day)) throw new Error(`${doctor.name} is not available on ${day}. Available days: ${doctor.availability.join(', ')}`);
          const r = await api(`/appointments/${a._id}/reschedule`, 'POST', values);
          showMessage('Appointment rescheduled to ' + fmtDate(r.date) + '.');
          rescheduleHolder.replaceChildren();
          await load();
        },
      });
      f.actions.append(el('button', { type: 'button', class: 'secondary', text: 'Close', onclick: () => rescheduleHolder.replaceChildren() }));
      rescheduleHolder.replaceChildren(f.el);
      f.el.scrollIntoView({ behavior: 'smooth' });
    }

    async function load() {
      const query = new URLSearchParams();
      if (statusFilter.value) query.set('status', statusFilter.value);
      if (dateFilter.value) query.set('date', dateFilter.value);
      const rows = await api('/appointments?' + query);
      const canDecide = role === 'doctor' || role === 'admin';
      const act = (label, path, cls, ask) => btn(label, async () => {
        const body = ask ? { note: prompt(ask) || '' } : undefined;
        const r = await api(`/appointments/${path}`, 'POST', body);
        showMessage(r.billId ? `Visit completed. Consultation bill ${r.billId} created.` : 'Appointment updated.');
        await load();
      }, cls);

      holder.replaceChildren(table(
        [
          { label: 'ID', get: (a) => a.appointmentId }, { label: 'When', get: (a) => fmtDate(a.date) }, { label: 'Patient', get: (a) => pname(a.patient) },
          { label: 'Doctor', get: (a) => dname(a.doctor) }, { label: 'Reason', get: (a) => a.reason || '-' },
          { label: 'Status', get: (a) => badge(a.status) },
          { label: 'Note', get: (a) => [a.rescheduledFrom && 'Rescheduled from ' + fmtDate(a.rescheduledFrom), a.note].filter(Boolean).join(' - ') || '-' },
        ],
        rows,
        (a) => [
          canDecide && a.status === 'pending' && act('Approve', `${a._id}/approve`),
          canDecide && (a.status === 'pending' || a.status === 'approved') && act('Reject', `${a._id}/reject`, 'danger', 'Reason for rejecting (optional):'),
          canDecide && (a.status === 'pending' || a.status === 'approved') && btn('Reschedule', () => openReschedule(a), 'secondary'),
          canDecide && a.status === 'approved' && act('Complete', `${a._id}/complete`),
          role !== 'doctor' && (a.status === 'pending' || a.status === 'approved') && act('Cancel', `${a._id}/cancel`, 'secondary'),
        ],
        'No appointments found.'
      ));
    }

    const canBook = role !== 'doctor';
    const form = canBook && buildForm({
      title: 'Book appointment', submitText: 'Request appointment',
      fields: [
        manager && { name: 'patient', label: 'Patient', type: 'select', required: true, options: opts(patients, pname) },
        { name: 'doctor', label: 'Doctor (available days shown)', type: 'select', required: true, options: doctors.map((d) => ({ value: d._id, label: `${dname(d)} | ${d.availability.join(', ')}` })) },
        { name: 'date', label: 'Date and time (30-minute slots)', type: 'datetime-local', step: 1800, required: true },
        { name: 'reason', label: 'Reason for visit' },
      ].filter(Boolean),
      async onSubmit(values) {
        // Friendly check in the browser; the server enforces the same rule
        const doctor = doctors.find((d) => d._id === values.doctor);
        const day = WEEKDAY_BY_GETDAY[new Date(values.date).getDay()];
        if (!doctor.availability.includes(day)) throw new Error(`${doctor.name} is not available on ${day}. Available days: ${doctor.availability.join(', ')}`);
        await api('/appointments', 'POST', values);
        showMessage('Appointment requested. It will be confirmed once the doctor approves it.');
        form.reset();
        await load();
      },
    });

    view.replaceChildren(...[form && form.el, rescheduleHolder, el('div', { class: 'toolbar filters' }, statusFilter, dateFilter), holder].filter(Boolean));
    await load();
  },
});
