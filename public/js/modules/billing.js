// Billing: generate bills (consultation / treatment / test), record payments, track payment status.
// Money is typed in rupees and sent to the server as whole paise.
registerModule({
  id: 'billing', title: 'Billing', roles: ['staff', 'patient'],
  render: async function renderBilling(view) {
    const staff = Auth.user.role !== 'patient'; // admin and staff
    const [bills, patients] = await Promise.all([api('/bills'), staff ? api('/patients') : []]);
    const refresh = () => renderBilling(view);
    const detail = el('div');
    const CATEGORIES = ['consultation', 'treatment', 'test', 'other'];

    // "category, description, quantity, price" per line; the description may itself contain commas
    function parseItems(text) {
      return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, n) => {
        const parts = line.split(',').map((s) => s.trim());
        const price = Number(parts.pop());
        const quantity = Number(parts.pop());
        const category = (parts.shift() || '').toLowerCase();
        const description = parts.join(', ');
        if (!CATEGORIES.includes(category)) throw new Error(`Line ${n + 1}: category must be ${CATEGORIES.join(', ')}`);
        if (!description) throw new Error(`Line ${n + 1}: description is missing`);
        if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Line ${n + 1}: quantity must be a whole number`);
        if (Number.isNaN(price) || price < 0) throw new Error(`Line ${n + 1}: price must be a number`);
        return { category, description, quantity, unitPrice: Math.round(price * 100) };
      });
    }

    const showItems = (b) => detail.replaceChildren(card(`Bill ${b.billId}: ${pname(b.patient)}`, table(
      [
        { label: 'Category', get: (i) => i.category }, { label: 'Description', get: (i) => i.description }, { label: 'Qty', get: (i) => i.quantity },
        { label: 'Unit price', get: (i) => money(i.unitPrice) }, { label: 'Amount', get: (i) => money(i.amount) },
      ],
      b.items, null, 'No items.')));

    const forms = [];
    if (staff) {
      forms.push(buildForm({
        title: 'Generate bill', submitText: 'Generate bill',
        fields: [
          { name: 'patient', label: 'Patient', type: 'select', required: true, options: opts(patients, pname) },
          { name: 'items', label: 'Items (one per line: category, description, quantity, price)', type: 'textarea', required: true,
            placeholder: 'consultation, General check-up, 1, 500\ntest, Blood sugar (fasting), 1, 150\ntreatment, Dressing, 2, 200' },
        ],
        async onSubmit(v) {
          const bill = await api('/bills', 'POST', { patient: v.patient, items: parseItems(v.items) });
          showMessage(`Bill ${bill.billId} generated: ${money(bill.total)}`);
          await refresh();
        },
      }));
      const unpaid = bills.filter((b) => b.status !== 'paid');
      forms.push(buildForm({
        title: 'Record payment', submitText: 'Record payment',
        fields: [
          { name: 'bill', label: 'Unpaid bill', type: 'select', required: true, options: unpaid.map((b) => ({ value: b._id, label: `${b.billId} | ${pname(b.patient)} | due ${money(b.total - b.paid)}` })) },
          { name: 'amount', label: 'Amount', type: 'money', min: 0.01, required: true },
        ],
        async onSubmit(v) { await api(`/bills/${v.bill}/pay`, 'POST', { amount: v.amount }); showMessage('Payment recorded.'); await refresh(); },
      }));
    }

    view.replaceChildren(...forms.map((f) => f.el), table(
      [
        { label: 'Bill', get: (b) => b.billId }, { label: 'Date', get: (b) => fmtDay(b.createdAt) }, { label: 'Patient', get: (b) => pname(b.patient) },
        { label: 'Total', get: (b) => money(b.total) }, { label: 'Paid', get: (b) => money(b.paid) }, { label: 'Balance', get: (b) => money(b.total - b.paid) },
        { label: 'Status', get: (b) => badge(b.status) },
      ],
      bills, (b) => [btn('View items', () => showItems(b), 'secondary')], 'No bills yet.'
    ), detail);
  },
});
