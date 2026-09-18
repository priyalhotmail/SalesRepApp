import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// Caller locks the customer first; invoice comparisons protect concurrent payments.
export async function applyCanCredits(
  tx: Prisma.TransactionClient,
  customerId: number,
) {
  const credits = await tx.canReturn.findMany({
    where: { customerId, status: "CONFIRMED", remainingCredit: { gt: 0 } },
    orderBy: { id: "asc" },
  });
  for (const credit of credits) {
    let remaining = credit.remainingCredit;
    const invoices = await tx.salesInvoice.findMany({
      where: {
        customerId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
    for (const invoice of invoices) {
      if (remaining.isZero()) break;
      const amount = Prisma.Decimal.min(remaining, invoice.balanceAmount);
      const balance = invoice.balanceAmount.minus(amount);
      const changed = await tx.salesInvoice.updateMany({
        where: {
          id: invoice.id,
          balanceAmount: invoice.balanceAmount,
          status: invoice.status,
        },
        data: {
          balanceAmount: balance,
          returnTotal: { increment: amount },
          canCreditTotal: { increment: amount },
          status: balance.isZero() ? "PAID" : invoice.status,
        },
      });
      if (!changed.count)
        throw new BadRequestException(
          "Invoice changed. Please retry confirmation.",
        );
      await tx.canCreditApplication.create({
        data: { canReturnId: credit.id, salesInvoiceId: invoice.id, amount },
      });
      remaining = remaining.minus(amount);
    }
    await tx.canReturn.update({
      where: { id: credit.id },
      data: { remainingCredit: remaining },
    });
  }
}
