const Bill = require('../models/Bill');
const httpError = require('../utils/httpError');
const { nextCode } = require('./sequence');

const CATEGORIES = ['consultation', 'treatment', 'test', 'other'];

// Validates the line items and computes each amount. unitPrice is a whole number of paise.
function buildItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw httpError(400, 'A bill needs between 1 and 50 items');
  return items.map((i, n) => {
    const row = `Item ${n + 1}: `;
    if (!i || !CATEGORIES.includes(i.category)) throw httpError(400, row + 'category must be consultation, treatment, test or other');
    if (typeof i.description !== 'string' || !i.description.trim()) throw httpError(400, row + 'description is required');
    if (!Number.isInteger(i.quantity) || i.quantity < 1) throw httpError(400, row + 'quantity must be a whole number of at least 1');
    if (!Number.isInteger(i.unitPrice) || i.unitPrice < 0) throw httpError(400, row + 'price must be a whole number of paise (0 or more)');
    return { category: i.category, description: i.description.trim(), quantity: i.quantity, unitPrice: i.unitPrice, amount: i.quantity * i.unitPrice };
  });
}

async function createBill({ patient, items, createdBy }) {
  const clean = buildItems(items);
  const total = clean.reduce((sum, i) => sum + i.amount, 0);
  return Bill.create({ billId: await nextCode('bill', 'B'), patient, items: clean, total, createdBy });
}

module.exports = { buildItems, createBill };
