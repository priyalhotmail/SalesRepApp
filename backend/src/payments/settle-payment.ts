import { BadRequestException } from "@nestjs/common";
import { Payment, Prisma } from "@prisma/client";

export type InvoiceAllocation = { invoiceId: number; amount: number };

export async function validateAllocations(
  tx: Prisma.TransactionClient,
  customerId: number,
  total: Prisma.Decimal | number,
  selected: InvoiceAllocation[],
) {
  if (
    !selected.length ||
    new Set(selected.map((a) => a.invoiceId)).size !== selected.length
  ) {
    throw new BadRequestException("Select each invoice only once");
  }
  if (
    selected.some(
      (a) =>
        !Number.isFinite(a.amount) ||
        a.amount <= 0 ||
        new Prisma.Decimal(a.amount).decimalPlaces() > 2,
    )
  ) {
    throw new BadRequestException(
      "Invoice payment amounts must be positive with at most two decimals",
    );
  }
  if (
    !selected
      .reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0))
      .equals(total)
  ) {
    throw new BadRequestException(
      "Invoice allocations must equal the payment amount",
    );
  }
  const invoices = await tx.salesInvoice.findMany({
    where: {
      id: { in: selected.map((a) => a.invoiceId) },
      customerId,
      deletedAt: null,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      balanceAmount: { gt: 0 },
    },
  });
  return selected.map((a) => {
    const invoice = invoices.find((i) => i.id === a.invoiceId);
    if (!invoice || new Prisma.Decimal(a.amount).gt(invoice.balanceAmount)) {
      throw new BadRequestException(
        "Selected invoice is invalid or payment exceeds its current balance",
      );
    }
    return {
      ...a,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate.toISOString(),
      balanceAtCollection: Number(invoice.balanceAmount),
    };
  });
}

// Save the exact allocations so cancellation reverses only this receipt.
export async function settlePayment(
  tx: Prisma.TransactionClient,
  payment: Payment,
) {
  const selected = Array.isArray(payment.allocations)
    ? (payment.allocations as InvoiceAllocation[])
    : undefined;
  if (selected)
    await validateAllocations(tx, payment.customerId, payment.amount, selected);
  const invoices = await tx.salesInvoice.findMany({
    where: {
      customerId: payment.customerId,
      id: selected
        ? { in: selected.map((a) => a.invoiceId) }
        : (payment.salesInvoiceId ?? undefined),
      deletedAt: null,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      balanceAmount: { gt: 0 },
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  let remaining = new Prisma.Decimal(payment.amount);
  const allocations: { invoiceId: number; amount: number }[] = [];
  for (const invoice of invoices) {
    if (remaining.isZero()) break;
    const allocation = selected?.find((a) => a.invoiceId === invoice.id);
    if (selected && !allocation) continue;
    const amount = allocation
      ? new Prisma.Decimal(allocation.amount)
      : Prisma.Decimal.min(remaining, invoice.balanceAmount);
    if (amount.gt(invoice.balanceAmount))
      throw new BadRequestException(
        "Selected invoice balance changed; refresh and try again",
      );
    const balance = invoice.balanceAmount.minus(amount);
    const updated = await tx.salesInvoice.updateMany({
      where: {
        id: invoice.id,
        balanceAmount: invoice.balanceAmount,
        paidAmount: invoice.paidAmount,
        status: invoice.status,
      },
      data: {
        balanceAmount: balance,
        paidAmount: { increment: amount },
        status: balance.isZero() ? "PAID" : "PARTIALLY_PAID",
      },
    });
    if (!updated.count)
      throw new BadRequestException("Invoice changed; refresh and try again");
    allocations.push({ invoiceId: invoice.id, amount: amount.toNumber() });
    remaining = remaining.minus(amount);
  }
  if (!remaining.isZero())
    throw new BadRequestException(
      "Payment exceeds remaining outstanding balance",
    );
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      allocations: selected
        ? (payment.allocations as Prisma.InputJsonValue)
        : allocations,
    },
  });
}
