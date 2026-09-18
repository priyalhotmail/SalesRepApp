require("reflect-metadata");
require("ts-node").register({ transpileOnly: true, project: "backend/tsconfig.json" });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { calculateInvoiceAmounts } = require("../src/sales-invoices/invoice-amounts");
const { SalesInvoicesService } = require("../src/sales-invoices/sales-invoices.service");
const d = n => new Prisma.Decimal(n);
function order(actual = 90, free = 0) {
  return { id: 1, customerId: 2, status: "LOADING", customer: { creditTermsDays: 30 },
    items: [{ id: 3, productId: 4, quantity: d(100), freeQuantity: d(free), unitPrice: d(10), discountAmount: d(100), lineTotal: d(900) }],
    delivery: { status: "PARTIALLY_DELIVERED", items: [{ orderItemId: 3, deliveredQuantity: d(actual) }] } };
}
test("100 dispatched, 10 rejected invoices 90 and prorates the discount", () => {
  const result = calculateInvoiceAmounts(order());
  assert.equal(result.items[0].quantity.toNumber(), 90);
  assert.equal(result.subtotal.toNumber(), 900);
  assert.equal(result.discountTotal.toNumber(), 90);
  assert.equal(result.totalAmount.toNumber(), 810);
});
test("fully rejected lines are omitted and zero delivery cannot create an invoice", () => {
  assert.throws(() => calculateInvoiceAmounts(order(0)), /No delivered/);
  const input = order();
  input.items.push({ ...input.items[0], id: 5, productId: 6 });
  input.delivery.items.push({ orderItemId: 5, deliveredQuantity: d(0) });
  assert.equal(calculateInvoiceAmounts(input).items.length, 1);
});
test("free units remain free and total invoice units equal delivered units", () => {
  const result = calculateInvoiceAmounts(order(105, 10));
  assert.equal(result.items[0].quantity.toNumber(), 100);
  assert.equal(result.items[0].freeQuantity.toNumber(), 5);
  assert.equal(result.totalAmount.toNumber(), 900);
});
test("full delivery retains order pricing and unconfirmed delivery is blocked", () => {
  const input = order(100);
  assert.equal(calculateInvoiceAmounts(input).totalAmount.toNumber(), 900);
  input.delivery.status = "DISPATCHED";
  assert.throws(() => calculateInvoiceAmounts(input), /Confirm delivery/);
});
test("fractional deliveries round money to cents and totals match invoice lines", () => {
  const input = order(0.333);
  input.items[0].quantity = d(1);
  input.items[0].unitPrice = d(10);
  input.items[0].discountAmount = d(1);
  const result = calculateInvoiceAmounts(input);
  assert.equal(result.items[0].quantity.toString(), "0.333");
  assert.equal(result.discountTotal.toString(), "0.33");
  assert.equal(result.totalAmount.toString(), "3");
  assert.equal(result.subtotal.toString(), "3.33");
});
test("invoice persistence and preview use delivered amounts before can credits", async () => {
  const input = order(); let saved;
  const tx = { customer: { update: async () => {} },
    salesInvoice: { create: async ({ data }) => { saved = data; return { id: 8 }; }, findUniqueOrThrow: async () => ({ id: 8, ...saved }) },
    canReturn: { findMany: async () => [] } };
  const prisma = { order: { findFirst: async () => input },
    salesInvoice: { findFirst: async () => null, count: async () => 0 },
    $transaction: async fn => fn(tx) };
  const service = new SalesInvoicesService({ record: async () => {} }, prisma);
  const actor = { id: 9, roles: ["SUPER_ADMIN"] };
  const preview = await service.previewFromOrder(1, actor);
  await service.createFromOrder({ orderId: 1 }, { actor });
  assert.equal(saved.items.create[0].quantity, 90);
  assert.equal(saved.balanceAmount, 810);
  assert.equal(saved.totalAmount, preview.totalAmount.toNumber());
});

for (const role of ["SUPER_ADMIN", "MAIN_OFFICE_AUTHORIZED_USER", "BRANCH_AUTHORIZED_USER"]) {
  test(`${role} can recover another driver's confirmed invoice even with a driver role`, async () => {
    const input = order();
    input.delivery.deliveryPlan = { driver: { userId: 50 } };
    const service = new SalesInvoicesService({}, { order: { findFirst: async () => input } });
    const preview = await service.previewFromOrder(1, { id: 9, roles: [role, "DELIVERY_PERSON"] });
    assert.equal(preview.totalAmount.toNumber(), 810);
    await assert.rejects(service.previewFromOrder(1, { id: 9, roles: ["DELIVERY_PERSON"] }), /only invoice a delivery they confirmed/);
  });
}
test("recovery cannot create a duplicate invoice", async () => {
  const service = new SalesInvoicesService({}, {
    order: { findFirst: async () => order() },
    salesInvoice: { findFirst: async () => ({ id: 8 }) }
  });
  await assert.rejects(service.createFromOrder({ orderId: 1 }, { actor: { id: 9, roles: ["SUPER_ADMIN"] } }), /already has/);
});
