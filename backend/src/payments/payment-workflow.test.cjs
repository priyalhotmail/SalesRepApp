require("reflect-metadata");
require("ts-node").register({ transpileOnly: true, project: "backend/tsconfig.json" });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { PaymentsService } = require("./payments.service");
const { ChequesService } = require("../cheques/cheques.service");
const { settlePayment, validateAllocations } = require("./settle-payment");
const context = { actor: { id: 1, roles: ["SUPER_ADMIN"], permissions: [] } };
const payment = { id: 1, customerId: 2, amount: new Prisma.Decimal(50), method: "CHEQUE", status: "TEMPORARY", customer: { officeId: 3 }, cheque: {} };
const audit = { record: async () => {} };
test("handover requires cheque number and date", async () => {
  const service = new PaymentsService(audit, { payment: { findUnique: async () => payment } });
  await assert.rejects(service.confirmPayment(1, {}, context), /number and cheque date/);
});
test("branch user cannot confirm another branch payment", async () => {
  const service = new PaymentsService(audit, { payment: { findUnique: async () => payment }, employee: { findUnique: async () => ({ status: "ACTIVE", officeId: 4 }) } });
  await assert.rejects(service.confirmPayment(1, {}, { actor: { id: 2, roles: ["BRANCH_AUTHORIZED_USER"] } }), /your branch/);
});
test("cheque handover waits for clearance without settling invoices", async () => {
  let status;
  const tx = { payment: { updateMany: async args => { status = args.data.status; return { count: 1 }; }, findUnique: async () => payment }, cheque: { update: async () => {} } };
  const service = new PaymentsService(audit, { payment: { findUnique: async () => payment }, $transaction: async fn => fn(tx) });
  await service.confirmPayment(1, { chequeNumber: "123", chequeDate: "2026-09-13" }, context);
  assert.equal(status, "AWAITING_CLEARANCE");
});
test("duplicate confirmation cannot settle again", async () => {
  const service = new PaymentsService(audit, { payment: { findUnique: async () => ({ ...payment, method: "CASH" }) }, $transaction: async fn => fn({ payment: { updateMany: async () => ({ count: 0 }) } }) });
  await assert.rejects(service.confirmPayment(1, {}, context), /Only temporary/);
});
test("temporary cheques cannot be reconciled", async () => {
  const service = new ChequesService(audit, { cheque: { findUnique: async () => ({ status: "RECEIVED", payment }) } });
  await assert.rejects(service.realizeCheque(1, context), /Confirm handover/);
});
test("settlement splits oldest invoices exactly and saves allocations", async () => {
  let allocations;
  const updates = [];
  const tx = { salesInvoice: { findMany: async () => [30, 40].map((n, i) => ({ id: i + 1, balanceAmount: new Prisma.Decimal(n), paidAmount: new Prisma.Decimal(0), status: "ISSUED" })), updateMany: async args => { updates.push(args); return { count: 1 }; } }, payment: { update: async args => { allocations = args.data.allocations; } } };
  await settlePayment(tx, payment);
  assert.deepEqual(allocations, [{ invoiceId: 1, amount: 30 }, { invoiceId: 2, amount: 20 }]);
  assert.equal(updates[0].data.status, "PAID");
  assert.equal(updates[1].data.balanceAmount.toNumber(), 20);
});
test("settlement rejects an amount exceeding outstanding", async () => {
  await assert.rejects(settlePayment({ salesInvoice: { findMany: async () => [] } }, payment), /exceeds/);
});

test("cash and cheques without details are captured temporarily without settling invoices", async () => {
  for (const method of ["CASH", "CHEQUE"]) {
    let created;
    let cheque;
    const tx = { payment: { create: async args => { created = args.data; return { id: 1 }; }, findUnique: async () => ({ ...payment, method }) }, cheque: { create: async args => { cheque = args.data; } } };
    const service = new PaymentsService(audit, { customer: { findFirst: async () => ({ id: 2 }) }, salesInvoice: { findMany: async () => [{ balanceAmount: 100, dueDate: new Date("2020-01-01") }] }, $transaction: async fn => fn(tx) });
    await service.createPayment({ customerId: 2, amount: 50, method }, context);
    assert.equal(created.status, "TEMPORARY");
    if (method === "CHEQUE") { assert.equal(cheque.chequeNumber, null); assert.equal(cheque.chequeDate, null); }
    else assert.equal(cheque, undefined);
  }
});
test("cancelling temporary cash does not reverse invoice balances", async () => {
  const tx = { payment: { updateMany: async () => ({ count: 1 }), update: async () => ({ ...payment, status: "CANCELLED" }) } };
  const service = new PaymentsService(audit, { payment: { findUnique: async () => ({ ...payment, method: "CASH", cheque: null, salesInvoiceId: 1 }) }, $transaction: async fn => fn(tx) });
  await service.cancelPayment(1, {}, context);
});

const selectedInvoices = [
  { id: 7, customerId: 2, invoiceNumber: "INV-7", dueDate: new Date("2026-01-01"), balanceAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(0), status: "ISSUED" },
  { id: 9, customerId: 2, invoiceNumber: "INV-9", dueDate: new Date("2026-02-01"), balanceAmount: new Prisma.Decimal(80), paidAmount: new Prisma.Decimal(0), status: "ISSUED" },
];
test("selected allocations validate total, duplicates, ownership and balances", async () => {
  const tx = { salesInvoice: { findMany: async () => selectedInvoices } };
  await assert.rejects(validateAllocations(tx, 2, 50, [{ invoiceId: 7, amount: 20 }]), /equal/);
  await assert.rejects(validateAllocations(tx, 2, 50, [{ invoiceId: 7, amount: 25 }, { invoiceId: 7, amount: 25 }]), /only once/);
  await assert.rejects(validateAllocations(tx, 2, 120, [{ invoiceId: 7, amount: 120 }]), /current balance/);
  await assert.rejects(validateAllocations(tx, 2, 50, [{ invoiceId: 999, amount: 50 }]), /invalid/);
  await assert.rejects(validateAllocations(tx, 2, 1.001, [{ invoiceId: 7, amount: 1.001 }]), /two decimals/);
});
test("selected invoice payments preserve explicit partial amounts at settlement", async () => {
  const updates = [];
  let saved;
  const allocations = [{ invoiceId: 7, amount: 15 }, { invoiceId: 9, amount: 35 }];
  const tx = { salesInvoice: { findMany: async () => selectedInvoices, updateMany: async args => { updates.push(args); return { count: 1 }; } }, payment: { update: async args => { saved = args.data.allocations; } } };
  await settlePayment(tx, { ...payment, allocations });
  assert.deepEqual(updates.map(a => [a.where.id, a.data.paidAmount.increment.toNumber()]), [[7, 15], [9, 35]]);
  assert.deepEqual(saved, allocations);
});
test("changed selected balance rejects settlement before any invoice update", async () => {
  const tx = { salesInvoice: { findMany: async () => [{ ...selectedInvoices[0], balanceAmount: new Prisma.Decimal(5) }] } };
  await assert.rejects(settlePayment(tx, { ...payment, allocations: [{ invoiceId: 7, amount: 50 }] }), /current balance/);
});
test("cash and cheque capture save selected invoice breakdown without settlement", async () => {
  for (const method of ["CASH", "CHEQUE"]) {
    let created;
    const tx = { salesInvoice: { findMany: async () => selectedInvoices }, payment: { create: async args => { created = args.data; return { id: 1 }; }, findUnique: async () => payment }, cheque: { create: async () => {} } };
    const service = new PaymentsService(audit, { customer: { findFirst: async () => ({ id: 2 }) }, salesInvoice: { findMany: async () => selectedInvoices }, $transaction: async fn => fn(tx) });
    await service.createPayment({ customerId: 2, amount: 50, method, allocations: [{ invoiceId: 7, amount: 15 }, { invoiceId: 9, amount: 35 }] }, context);
    assert.equal(created.status, "TEMPORARY");
    assert.equal(created.allocations[0].invoiceNumber, "INV-7");
    assert.equal(created.allocations[1].amount, 35);
  }
});
