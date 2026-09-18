require("reflect-metadata");
require("ts-node").register({ transpileOnly:true, project:"backend/tsconfig.json" });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { applyCanCredits } = require("./can-credit");
const { CanReturnsService } = require("./can-returns.service");
const { DriverDayService } = require("./driver-day.service");
const dec=n=>new Prisma.Decimal(n);
const actor={id:1,roles:["SUPER_ADMIN"],permissions:[]};
function creditTx(balance, credit) {
 const applications=[]; let remaining;
 return { applications, get remaining(){return remaining;},
 canReturn:{findMany:async args=>{assert.equal(args.where.status,"CONFIRMED");return [{id:1,remainingCredit:dec(credit)}];},update:async args=>{remaining=args.data.remainingCredit.toNumber();}},
 salesInvoice:{findMany:async()=>balance.map((n,i)=>({id:i+1,balanceAmount:dec(n),status:"ISSUED"})),updateMany:async()=>({count:1})},
 canCreditApplication:{create:async args=>applications.push(args.data)} };
}
test("five cans at LKR 10 reduce a bill by 50 across oldest invoices",async()=>{
 const tx=creditTx([30,100],50);await applyCanCredits(tx,1);
 assert.deepEqual(tx.applications.map(a=>[a.salesInvoiceId,a.amount.toNumber()]),[[1,30],[2,20]]);assert.equal(tx.remaining,0);
});
test("paid invoices leave confirmed credit available for the next invoice",async()=>{
 const tx=creditTx([],50);await applyCanCredits(tx,1);assert.equal(tx.remaining,50);assert.equal(tx.applications.length,0);
 const next=creditTx([35],tx.remaining);await applyCanCredits(next,1);assert.equal(next.remaining,15);assert.equal(next.applications[0].amount.toNumber(),35);
});
test("concurrent invoice balance changes reject credit posting",async()=>{
 const tx=creditTx([100],50);tx.salesInvoice.updateMany=async()=>({count:0});await assert.rejects(applyCanCredits(tx,1),/changed/);assert.equal(tx.applications.length,0);
});
test("temporary can collection snapshots value without giving credit",async()=>{
 let saved;const tx={customer:{update:async()=>{}},canReturn:{create:async args=>{saved=args.data;return {id:1};}},auditLog:{create:async()=>{}}};
 const service=new CanReturnsService({$transaction:async fn=>fn(tx)});
 service.eligibility=async()=>({customer:{officeId:3},sizes:[{id:1,name:"5L",available:5,returnValue:dec(10)}]});
 await service.create({customerId:2,items:[{canTypeId:1,quantity:5}]},actor);
 assert.equal(saved.totalAmount.toNumber(),50);assert.equal(saved.items[0].returnValue,10);assert.equal(saved.remainingCredit,undefined);
 await assert.rejects(service.create({customerId:2,items:[{canTypeId:1,quantity:6}]},actor),/exceeds/);
});
test("duplicate confirmation cannot award credit twice",async()=>{
 const tx={canReturn:{findFirst:async()=>({id:1,customerId:2,totalAmount:dec(50)}),updateMany:async()=>({count:0})},customer:{update:async()=>{}}};
 const service=new CanReturnsService({$transaction:async fn=>fn(tx)});await assert.rejects(service.confirm(1,actor),/Only temporary/);
});
test("branch cannot confirm returns from another office",async()=>{
 const service=new CanReturnsService({employee:{findUnique:async()=>({status:"ACTIVE",officeId:3})},$transaction:async fn=>fn({canReturn:{findFirst:async args=>{assert.equal(args.where.officeId,3);return null;}}})});
 await assert.rejects(service.confirm(1,{...actor,roles:["BRANCH_AUTHORIZED_USER"]}),/your branch/);
});
test("eligibility subtracts pending and confirmed cans and includes paid deliveries",async()=>{
 const tx={customer:{findFirst:async()=>({id:2,officeId:3})},canType:{findMany:async()=>[{id:1,name:"5L",productIds:[7],returnValue:dec(10)}]},delivery:{findMany:async()=>[{orderId:8,items:[{productId:7,deliveredQuantity:dec(10)}]}]},canReturn:{findMany:async()=>[{status:"TEMPORARY",items:[{canTypeId:1,quantity:3}],remainingCredit:dec(0)},{status:"CONFIRMED",items:[{canTypeId:1,quantity:2}],remainingCredit:dec(20)}]},salesInvoice:{findMany:async()=>[]}};
 const service=new CanReturnsService(tx);const result=await service.eligibility(2,actor);assert.equal(result.sizes[0].available,5);assert.equal(result.creditBalance,20);assert.equal(result.invoices.length,0);
});
test("undelivered receipt cannot be confirmed twice and never increments stock",async()=>{
 const tx={delivery:{findFirst:async()=>({status:"PARTIALLY_DELIVERED",items:[{orderedQuantity:dec(5),deliveredQuantity:dec(3)}]}),updateMany:async()=>({count:0})}};
 const service=new DriverDayService({$transaction:async fn=>fn(tx)},{officeScope:async()=>3});await assert.rejects(service.receiveUndelivered(1,actor),/already/);
});
test("driver summary separates cash confirmation, cheque handover and clearance",async()=>{
 const payments=[{method:"CASH",status:"TEMPORARY",amount:dec(10)},{method:"CASH",status:"POSTED",amount:dec(20)},{method:"CHEQUE",status:"AWAITING_CLEARANCE",amount:dec(30)},{method:"CHEQUE",status:"POSTED",amount:dec(40)}];
 const prisma={deliveryPlan:{findMany:async()=>[]},payment:{findMany:async args=>{assert.equal(args.where.createdById,9);return payments;}},salesReturn:{findMany:async()=>[]},canReturn:{findMany:async()=>[]},delivery:{findMany:async()=>[]}};
 const service=new DriverDayService(prisma,{});service.drivers=async()=>[{id:4,userId:9}];const r=await service.summary({driverId:4,date:"2026-09-13"},actor);assert.equal(r.totals.cash,30);assert.equal(r.totals.cashConfirmed,20);assert.equal(r.totals.chequeCount,2);assert.equal(r.totals.chequeReceived,2);assert.equal(r.totals.chequeCleared,1);
});

test("existing can settings allow adding and removing products", async () => {
 let saved;
 const existing = { id: 1, productIds: [7,8], capacityLitres: dec(5) };
 const tx = { $queryRaw: async () => [], canType: { findMany: async () => [existing], update: async args => { saved = args.data; return { id:1, ...args.data }; } }, auditLog: { create: async () => {} } };
 const service = new CanReturnsService({ product: { findMany: async () => [{id:8,unitType:"L",capacity:dec(5)},{id:9,unitType:"L",capacity:dec(5)}] }, $transaction: async fn => fn(tx) });
 await service.saveType({name:"5L",capacityLitres:5,returnValue:10,productIds:[8,9],active:true},actor,1);
 assert.deepEqual(saved.productIds,[8,9]);
 tx.canType.findMany = async () => [existing, {id:2,productIds:[9],capacityLitres:dec(5)}];
 await assert.rejects(service.saveType({name:"5L",capacityLitres:5,returnValue:10,productIds:[8,9]},actor,1), /already assigned/);
});
