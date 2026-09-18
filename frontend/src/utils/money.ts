const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
});

export function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  return Number.isFinite(amount) ? moneyFormatter.format(amount) : "-";
}

export function isMoneyField(path: string): boolean {
  const field = path.split(".").pop() ?? "";
  return /(?:amount|price|revenue|cost|balance|credit|subtotal)$/i.test(field)
    || ["creditLimit", "revenueTarget", "returnValue", "discountTotal", "returnTotal",
      "lineTotal", "canCreditTotal", "stockValue",
      "projectedOutstanding", "totalOutstanding"].includes(field);
}
