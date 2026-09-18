import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

type OrderLine = {
  id: number;
  productId: number;
  quantity: Prisma.Decimal;
  freeQuantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};
type Delivery = {
  status: string;
  items: { orderItemId: number; deliveredQuantity: Prisma.Decimal }[];
};

export function calculateInvoiceAmounts<T extends OrderLine>(order: {
  items: T[];
  delivery: Delivery | null;
}) {
  if (order.delivery && !["DELIVERED", "PARTIALLY_DELIVERED"].includes(order.delivery.status)) {
    throw new BadRequestException("Confirm delivery before generating its invoice");
  }
  const delivered = new Map(order.delivery?.items.map(item => [item.orderItemId, item.deliveredQuantity]));
  const items = order.items.flatMap(item => {
    const actual = order.delivery ? delivered.get(item.id) ?? new Prisma.Decimal(0)
      : item.quantity.plus(item.freeQuantity);
    if (actual.lte(0)) return [];
    if (actual.gt(item.quantity.plus(item.freeQuantity))) {
      throw new BadRequestException("Delivered quantity exceeds the order quantity");
    }
    // Delivery records combine paid and free units; allocate paid units first.
    const quantity = Prisma.Decimal.min(item.quantity, actual);
    const freeQuantity = actual.minus(quantity);
    const discountAmount = item.quantity.gt(0)
      ? item.discountAmount.mul(quantity).div(item.quantity).toDecimalPlaces(2)
      : new Prisma.Decimal(0);
    const lineTotal = Prisma.Decimal.max(quantity.mul(item.unitPrice).minus(discountAmount), 0).toDecimalPlaces(2);
    return [{ ...item, quantity, freeQuantity, discountAmount, lineTotal }];
  });
  if (!items.length) throw new BadRequestException("No delivered quantities are available to invoice");
  const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0)).toDecimalPlaces(2);
  return {
    items,
    subtotal: sum(items.map(item => item.lineTotal.plus(item.discountAmount))),
    discountTotal: sum(items.map(item => item.discountAmount)),
    totalAmount: sum(items.map(item => item.lineTotal))
  };
}
