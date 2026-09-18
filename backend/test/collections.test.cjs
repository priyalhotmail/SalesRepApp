require("reflect-metadata");
require("ts-node").register({
  transpileOnly: true,
  project: "backend/tsconfig.json",
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CollectionsService,
} = require("../src/collections/collections.service");
const hq = { id: 1, roles: ["MAIN_OFFICE_AUTHORIZED_USER"] };
const branch = { id: 2, roles: ["BRANCH_AUTHORIZED_USER"] };
const dto = {
  officeId: 3,
  paymentIds: [8],
  destination: "HEAD_OFFICE",
  sentAt: "2026-09-01T00:00:00Z",
  reference: "Courier 123",
};
function fixture() {
  const events = [];
  let claim = 1;
  const tx = {
    $queryRaw: async () => [],
    payment: {
      findMany: async (args) => {
        assert.equal(args.where.collectionOfficeId, 3);
        assert.deepEqual(args.where.remittanceItem, { is: null });
        return [{ id: 8, method: "CASH", amount: 100 }];
      },
    },
    cheque: {
      updateMany: async (args) => {
        events.push(args);
        return { count: 1 };
      },
    },
    collectionRemittance: {
      create: async ({ data }) => {
        events.push(data);
        return data;
      },
      updateMany: async (args) => {
        events.push(args);
        return { count: claim };
      },
      findUnique: async () => ({ id: "t" }),
    },
    auditLog: { create: async (args) => events.push(args) },
  };
  const prisma = {
    employee: {
      findUnique: async () => ({ status: "ACTIVE", branchId: 3, officeId: 1 }),
    },
    $transaction: async (fn) => fn(tx),
  };
  return {
    service: new CollectionsService(prisma),
    tx,
    events,
    setClaim: (n) => {
      claim = n;
    },
  };
}
test("branch access is restricted to its assigned branch", async () => {
  const f = fixture();
  assert.equal(await f.service.scope(branch), 3);
  await assert.rejects(f.service.scope(branch, 4), /only access your branch/);
  await assert.rejects(
    f.service.scope({ id: 5, roles: ["DELIVERY_PERSON"] }),
    /Branch or head-office/,
  );
});
test("cash handover snapshots amount without changing customer balances", async () => {
  const f = fixture();
  const result = await f.service.send(dto, branch);
  assert.equal(result.items.create[0].amount, 100);
  assert.equal(result.destination, "HEAD_OFFICE");
  assert.equal(result.createdById, 2);
});
test("already sent or ineligible receipts reject the entire transfer", async () => {
  const f = fixture();
  f.tx.payment.findMany = async () => [];
  await assert.rejects(f.service.send(dto, branch), /already transferred/);
  assert.equal(f.events.length, 0);
});
test("bank deposits require bank details and reject postdated cheques", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.send({ ...dto, destination: "BANK" }, branch),
    /bank name/,
  );
  f.tx.payment.findMany = async () => [
    {
      id: 8,
      method: "CHEQUE",
      amount: 100,
      cheque: { id: 9, chequeDate: new Date("2026-09-20") },
    },
  ];
  await assert.rejects(
    f.service.send({ ...dto, destination: "BANK", bankName: "Bank A" }, branch),
    /post-dated/,
  );
  const transfer = await f.service.send(dto, branch);
  assert.equal(transfer.destination, "HEAD_OFFICE");
});
test("bank deposit changes cheque to deposited, never realized", async () => {
  const f = fixture();
  f.tx.payment.findMany = async () => [
    {
      id: 8,
      method: "CHEQUE",
      amount: 100,
      cheque: { id: 9, chequeDate: new Date("2026-08-20") },
    },
  ];
  await f.service.send(
    { ...dto, destination: "BANK", bankName: "Bank A" },
    branch,
  );
  assert.equal(f.events[0].data.status, "DEPOSITED");
});
test("branch cannot review; head office can flag missing and later confirm", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.review("t", { status: "RECEIVED" }, branch),
    /Only head office/,
  );
  await assert.rejects(
    f.service.review("t", { status: "NOT_RECEIVED" }, hq),
    /Explain/,
  );
  await f.service.review(
    "t",
    { status: "NOT_RECEIVED", notes: "Courier not arrived" },
    hq,
  );
  assert.equal(f.events[0].where.status, "PENDING");
  f.events.length = 0;
  await f.service.review("t", { status: "RECEIVED" }, hq);
  assert.deepEqual(f.events[0].where.status.in, ["PENDING", "NOT_RECEIVED"]);
  f.setClaim(0);
  await assert.rejects(
    f.service.review("t", { status: "RECEIVED" }, hq),
    /already reviewed/,
  );
});
