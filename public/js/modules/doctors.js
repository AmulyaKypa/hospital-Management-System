// Doctor profiles: admin adds/edits everything; a doctor edits their own availability and contact
registerModule({
  id: 'doctors', title: 'Doctors', roles: ['*'],
  render: async function renderDoctors(view, credentials = null) {
    const doctors = await api('/doctors');
    const user = Auth.user;
    const isAdmin = user.role === 'admin';
    const mine = user.role === 'doctor' ? doctors.find((d) => d._id === user.doctor) : null;
    const dayOptions = DAYS.map((d) => ({ value: d, label: d }));
    let editingId = null;
    let form = null;
    const cancel = el('button', { type: 'button', class: 'secondary', hidden: true, text: 'Cancel edit', onclick: () => stopEdit() });

    function startEdit(d) {
      editingId = d._id;
      form.set({ name: d.name, specialization: d.specialization, contact: d.contact, fee: (d.fee || 0) / 100, availability: d.availability });
      form.title.textContent = 'Edit doctor ' + d.doctorId;
      form.submit.textContent = 'Save changes';
      cancel.hidden = false;
      form.el.scrollIntoView({ behavior: 'smooth' });
    }
    function stopEdit() {
      editingId = null;
      form.reset();
      form.title.textContent = 'Add doctor';
      form.submit.textContent = 'Add doctor';
      cancel.hidden = true;
    }

    let panel = null;
    if (isAdmin) {
      form = buildForm({
        title: 'Add doctor', submitText: 'Add doctor',
        fields: [
          { name: 'name', label: 'Name', required: true },
          { name: 'specialization', label: 'Specialization', required: true },
          { name: 'contact', label: 'Contact', required: true, pattern: CONTACT_PATTERN, placeholder: '7-15 digits' },
          { name: 'fee', label: 'Consultation fee', type: 'money', min: 0 },
          { name: 'availability', label: 'Available days', type: 'checkboxes', options: dayOptions, default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], required: true },
        ],
        async onSubmit(values) {
          if (editingId) { await api('/doctors/' + editingId, 'PUT', values); showMessage('Doctor updated.'); stopEdit(); }
          else {
            const doctor = await api('/doctors', 'POST', values);
            showMessage('Doctor added.');
            form.reset();
            await renderDoctors(view, doctor.login);
            return;
          }
          await renderDoctors(view);
        },
      });
      form.actions.append(cancel);
      panel = form.el;
    } else if (mine) {
      const own = buildForm({
        title: 'My availability', submitText: 'Save availability',
        fields: [
          { name: 'availability', label: 'Days I am available', type: 'checkboxes', options: dayOptions, default: mine.availability, required: true },
          { name: 'contact', label: 'Contact', required: true, pattern: CONTACT_PATTERN },
        ],
        async onSubmit(values) { await api('/doctors/' + mine._id, 'PUT', values); showMessage('Availability saved.'); await renderDoctors(view); },
      });
      own.set({ contact: mine.contact });
      panel = own.el;
    }

    view.replaceChildren(...[credentials && credentialsCard(credentials), panel, table(
      [
        { label: 'ID', get: (d) => d.doctorId }, { label: 'Name', get: (d) => d.name }, { label: 'Specialization', get: (d) => d.specialization },
        { label: 'Available', get: (d) => d.availability.join(', ') }, { label: 'Contact', get: (d) => d.contact }, { label: 'Fee', get: (d) => money(d.fee || 0) },
      ],
      doctors, isAdmin ? (d) => [btn('Edit', () => startEdit(d), 'secondary')] : null, 'No doctors yet.'
    )].filter(Boolean));
  },
});
