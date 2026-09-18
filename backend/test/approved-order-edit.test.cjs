require("reflect-metadata");
require("ts-node").register({ transpileOnly: true, project: "backend/tsconfig.json" });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OrdersService } = require("../src/orders/orders.service");

function fixture(role = "SUPER_ADMIN", status = "APPROVED") {
  const order = { id: 1, status, updatedAt: new Date(), customerId: 2, officeId: 3,
    totalAmount: 100, customer: { creditLimit: 150, creditHold: false } };
  const writes = [];
  const tx = { order: { updateMany: async () => ({ count: 1 }),
    update: async ({ data }) => { writes.push(data); return { ...order, ...data, status: data.status ?? status }; } },
    orderItem: { deleteMany: async () => { writes.push("delete"); } } };
  const prisma = { $transaction: async fn => fn(tx), stockReservation: { count: async () => 0 },
    creditOverrideRequest: { findFirst: async () => null },
    salesInvoice: { aggregate: async () => ({ _sum: { balanceAmount: 20 } }) } };
  const service = new OrdersService({ record: async () => {} }, {}, {}, prisma);
  service.findOrderById = async () => order;
  service.prepareOrder = async () => ({ items: [], subtotal: 120, discountTotal: 0, totalAmount: 120 });
  return { service, tx, prisma, writes, context: { actor: { id: 9, roles: [role] } } };
}

for (const role of ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER", "BRANCH_AUTHORIZED_USER"]) {
  test(`${role} can edit approved items and retain approval`, async () => {
    const f = fixture(role);
    const result = await f.service.updateOrder(1, { items: [{}], notes: "Changed" }, f.context);
    assert.equal(result.status, "APPROVED");
    assert.equal(result.totalAmount, 120);
    assert.equal(result.notes, "Changed");
  });
}
test("sales reps cannot edit approved orders", async () => {
  const f = fixture("SALES_REP");
  await assert.rejects(f.service.updateOrder(1, { notes: "Changed" }, f.context), /Only draft/);
  assert.equal(f.writes.length, 0);
});
test("reserved orders and active reservations block edits", async () => {
  const f = fixture("SUPER_ADMIN", "RESERVED");
  await assert.rejects(f.service.updateOrder(1, {}, f.context), /Only draft/);
  const g = fixture(); g.prisma.stockReservation.count = async () => 1;
  await assert.rejects(g.service.updateOrder(1, {}, g.context), /active reservations/);
});
test("approved edits cannot downgrade status or exceed credit", async () => {
  const f = fixture();
  await assert.rejects(f.service.updateOrder(1, { status: "DRAFT" }, f.context), /remain approved/);
  f.prisma.salesInvoice.aggregate = async () => ({ _sum: { balanceAmount: 40 } });
  await assert.rejects(f.service.updateOrder(1, { items: [{}] }, f.context), /credit limit/);
  assert.equal(f.writes.length, 0);
});
test("a concurrent status change aborts before replacing items", async () => {
  const f = fixture(); f.tx.order.updateMany = async () => ({ count: 0 });
  await assert.rejects(f.service.updateOrder(1, { items: [{}] }, f.context), /changed while editing/);
  assert.equal(f.writes.length, 0);
});
test("submitted orders remain editable by sales reps", async () => {
  const f = fixture("SALES_REP", "SUBMITTED");
  assert.equal((await f.service.updateOrder(1, { notes: "Changed" }, f.context)).notes, "Changed");
});
