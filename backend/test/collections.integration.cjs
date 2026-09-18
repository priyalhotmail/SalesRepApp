require("reflect-metadata");
require("dotenv").config({ path: "backend/.env" });
require("ts-node").register({
  transpileOnly: true,
  project: "backend/tsconfig.json",
});
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const {
  CollectionsService,
} = require("../src/collections/collections.service");
const { PaymentsService } = require("../src/payments/payments.service");
const db = new PrismaClient();
const rollback = new Error("ROLLBACK_TEST");
(async () => {
  try {
    await db.$transaction(
      async (tx) => {
        const office = await tx.office.findFirst();
        const user = await tx.user.findFirst();
        assert.ok(office && user);
        const actor = { id: user.id, roles: ["SUPER_ADMIN"] };
        const customer = await tx.customer.create({
          data: {
            officeId: office.id,
            code: `COL-TEST-${Date.now()}`,
            customerType: "INDIVIDUAL",
            displayName: "Temporary collections test",
          },
        });
        const payment = await tx.payment.create({
          data: {
            paymentNumber: `COL-CASH-${Date.now()}`,
            customerId: customer.id,
            collectionOfficeId: office.id,
            paymentDate: new Date(),
            method: "CASH",
            status: "POSTED",
            confirmedAt: new Date(),
            amount: 1234.56,
          },
        });
        const chequePayment = await tx.payment.create({
          data: {
            paymentNumber: `COL-CHQ-${Date.now()}`,
            customerId: customer.id,
            collectionOfficeId: office.id,
            paymentDate: new Date(),
            method: "CHEQUE",
            status: "AWAITING_CLEARANCE",
            confirmedAt: new Date(),
            amount: 500,
            cheque: {
              create: {
                customerId: customer.id,
                chequeNumber: "TEST-123",
                chequeDate: new Date("2026-01-01"),
                receivedDate: new Date(),
                amount: 500,
              },
            },
          },
        });
        const service = new CollectionsService({
          ...tx,
          $transaction: (fn) => fn(tx),
        });
        const available = await service.availablePayments(actor, {
          officeId: office.id,
          page: 1,
          limit: 100,
        });
        assert.ok(available.meta.total >= 2);
        const transfer = await service.send(
          {
            officeId: office.id,
            paymentIds: [payment.id],
            destination: "HEAD_OFFICE",
            sentAt: new Date().toISOString(),
            reference: "TEST handover",
          },
          actor,
        );
        assert.equal(transfer.items[0].amount.toNumber(), 1234.56);
        await assert.rejects(
          service.send(
            {
              officeId: office.id,
              paymentIds: [payment.id],
              destination: "HEAD_OFFICE",
              sentAt: new Date().toISOString(),
              reference: "duplicate",
            },
            actor,
          ),
          /already transferred/,
        );
        await service.review(
          transfer.id,
          { status: "NOT_RECEIVED", notes: "Temporary test" },
          actor,
        );
        await service.review(transfer.id, { status: "RECEIVED" }, actor);
        assert.equal(
          (
            await tx.collectionRemittance.findUnique({
              where: { id: transfer.id },
            })
          ).status,
          "RECEIVED",
        );
        const paymentService = new PaymentsService(
          {},
          { ...tx, $transaction: (fn) => fn(tx) },
        );
        await assert.rejects(
          paymentService.cancelPayment(payment.id, {}, { actor }),
          /sent\/deposited/,
        );
        const deposit = await service.send(
          {
            officeId: office.id,
            paymentIds: [chequePayment.id],
            destination: "BANK",
            bankName: "Test bank",
            reference: "Test slip",
            sentAt: new Date().toISOString(),
          },
          actor,
        );
        await service.review(deposit.id, { status: "RECEIVED" }, actor);
        assert.equal(
          (
            await tx.cheque.findUnique({
              where: { paymentId: chequePayment.id },
            })
          ).status,
          "DEPOSITED",
        );
        assert.equal(
          (await tx.payment.findUnique({ where: { id: chequePayment.id } }))
            .status,
          "AWAITING_CLEARANCE",
        );
        const dashboard = await service.dashboard(actor, {
          officeId: office.id,
        });
        assert.ok(
          dashboard.branches[0].buckets.HEAD_OFFICE_RECEIVED.cash >= 1234.56,
        );
        assert.ok(dashboard.branches[0].buckets.BANK_RECEIVED.cheque >= 500);
        throw rollback;
      },
      { timeout: 20000 },
    );
  } catch (e) {
    if (e !== rollback) throw e;
  }
  console.log(
    "Local MySQL transfer, deposit, review, summary and cancellation checks passed; all fixtures rolled back.",
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
