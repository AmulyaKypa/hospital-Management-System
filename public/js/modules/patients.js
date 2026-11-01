// Patient records: search, register/edit/assign (admin, staff), history and lab reports (doctor, admin, staff)

// Shows one patient's full record. Used by the Patients page and by the patient's own "My Health" page.
async function renderRecord(holder, patientId) {
  const p = await api('/patients/' + patientId);
  const role = Auth.user.role;
  const canHistory = ['admin', 'doctor'].includes(role);
  const canLab = ['admin', 'doctor', 'staff'].includes(role);
  const refresh = () => renderRecord(holder, patientId);

  const profile = card(`${p.name} (${p.patientId})`, el('div', { class: 'kv-grid' },
    field('Age', p.age), field('Gender', p.gender), field('Contact', p.contact), field('Blood group', p.bloodGroup),
    field('Allergies', p.allergies), field('Condition', p.condition), field('Address', p.address),
    field('Assigned doctor', p.assignedDoctor ? dname(p.assignedDoctor) : 'Not assigned')));

  const history = card('Medical history and prescriptions', table(
    [
      { label: 'Date', get: (h) => fmtDay(h.date) }, { label: 'Diagnosis', get: (h) => h.diagnosis },
      { label: 'Prescription', get: (h) => h.prescription || '-' }, { label: 'Notes', get: (h) => h.notes || '-' }, { label: 'Doctor', get: (h) => h.doctor ? h.doctor.name : '-' },
    ],
    [...p.medicalHistory].reverse(), null, 'No history recorded yet.'));

  const labs = card('Lab reports', table(
    [{ label: 'Date', get: (l) => fmtDay(l.date) }, { label: 'Test', get: (l) => l.testName }, { label: 'Result', get: (l) => l.result }, { label: 'Notes', get: (l) => l.notes || '-' }],
    [...p.labReports].reverse(), null, 'No lab reports yet.'));

  const historyForm = canHistory && buildForm({
    title: 'Add diagnosis / prescription', submitText: 'Add to history',
    fields: [
      { name: 'diagnosis', label: 'Diagnosis', required: true },
      { name: 'prescription', label: 'Prescription' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    async onSubmit(values) { await api(`/patients/${p._id}/history`, 'POST', values); showMessage('History updated.'); await refresh(); },
  });
  const labForm = canLab && buildForm({
    title: 'Add lab report', submitText: 'Add lab report',
    fields: [
      { name: 'testName', label: 'Test name', required: true },
      { name: 'result', label: 'Result', required: true },
      { name: 'notes', label: 'Notes' },
    ],
    async onSubmit(values) { await api(`/patients/${p._id}/lab-reports`, 'POST', values); showMessage('Lab report added.'); await refresh(); },
  });

  holder.replaceChildren(...[profile, history, historyForm && historyForm.el, labs, labForm && labForm.el].filter(Boolean));
}

registerModule({
  id: 'patients', title: 'Patients', roles: ['staff', 'doctor'],
  render: async function renderPatients(view) {
    const role = Auth.user.role;
    const canWrite = ['admin', 'staff'].includes(role);
    const doctors = await api('/doctors');
    const doctorName = Object.fromEntries(doctors.map((d) => [d._id, d.name]));
    let editingId = null;
    let form = null;

    const search = el('input', { type: 'search', class: 'search', placeholder: 'Search by patient ID, name or condition' });
    const holder = el('div');
    const recordHolder = el('div');
    const credentialsHolder = el('div');

    async function load() {
      const patients = await api('/patients?q=' + encodeURIComponent(search.value.trim()));
      holder.replaceChildren(table(
        [
          { label: 'ID', get: (p) => p.patientId }, { label: 'Name', get: (p) => p.name }, { label: 'Age', get: (p) => p.age },
          { label: 'Gender', get: (p) => p.gender }, { label: 'Condition', get: (p) => p.condition || '-' }, { label: 'Contact', get: (p) => p.contact },
          { label: 'Doctor', get: (p) => doctorName[p.assignedDoctor] || '-' },
        ],
        patients,
        (p) => [
          btn('Records', async () => { await renderRecord(recordHolder, p._id); recordHolder.scrollIntoView({ behavior: 'smooth' }); }, 'secondary'),
          canWrite && btn('Edit', () => startEdit(p), 'secondary'),
          role === 'admin' && btn('Delete', () => remove(p), 'danger'),
        ],
        role === 'doctor' ? 'No patients are assigned to you yet.' : 'No patients found.'
      ));
    }
    let timer;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load().catch((e) => showMessage(e.message, 'error')), 300); });

    function startEdit(p) {
      editingId = p._id;
      form.set({ name: p.name, age: p.age, gender: p.gender, contact: p.contact, address: p.address, bloodGroup: p.bloodGroup, allergies: p.allergies, condition: p.condition, assignedDoctor: p.assignedDoctor });
      form.title.textContent = 'Edit patient ' + p.patientId;
      form.submit.textContent = 'Save changes';
      cancel.hidden = false;
      form.el.scrollIntoView({ behavior: 'smooth' });
    }
    function stopEdit() {
      editingId = null;
      form.reset();
      form.title.textContent = 'Register patient';
      form.submit.textContent = 'Register patient';
      cancel.hidden = true;
    }
    async function remove(p) {
      if (!confirm(`Delete patient ${p.name} (${p.patientId}) and their whole record?`)) return;
      await api('/patients/' + p._id, 'DELETE');
      showMessage('Patient deleted.');
      recordHolder.replaceChildren();
      await load();
    }

    const cancel = el('button', { type: 'button', class: 'secondary', hidden: true, text: 'Cancel edit', onclick: () => stopEdit() });
    if (canWrite) {
      form = buildForm({
        title: 'Register patient', submitText: 'Register patient',
        fields: [
          { name: 'name', label: 'Name', required: true },
          { name: 'age', label: 'Age', type: 'number', min: 0, max: 120, required: true },
          { name: 'gender', label: 'Gender', type: 'select', required: true, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
          { name: 'contact', label: 'Contact', required: true, pattern: CONTACT_PATTERN, placeholder: '7-15 digits' },
          { name: 'bloodGroup', label: 'Blood group', type: 'select', placeholder: 'Unknown', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => ({ value: g, label: g })) },
          { name: 'condition', label: 'Current condition' },
          { name: 'allergies', label: 'Allergies' },
          { name: 'address', label: 'Address' },
          { name: 'assignedDoctor', label: 'Assigned doctor', type: 'select', placeholder: 'Not assigned', options: opts(doctors, dname) },
        ],
        async onSubmit(values) {
          if (editingId) {
            await api('/patients/' + editingId, 'PUT', values);
            showMessage('Patient updated.');
            stopEdit();
          } else {
            const p = await api('/patients', 'POST', values);
            showMessage('Patient registered. ID: ' + p.patientId);
            credentialsHolder.replaceChildren(credentialsCard(p.login));
            form.reset();
          }
          await load();
        },
      });
      form.actions.append(cancel);
    }

    view.replaceChildren(...[credentialsHolder, form && form.el, el('div', { class: 'toolbar' }, search), holder, recordHolder].filter(Boolean));
    await load();
  },
});

registerModule({
  id: 'my-health', title: 'My Health', roles: ['patient'], only: true,
  render: async function renderMyHealth(view) {
    const holder = el('div');
    view.replaceChildren(holder);
    await renderRecord(holder, Auth.user.patient);
  },
});
