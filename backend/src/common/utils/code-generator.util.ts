export function nextSequentialCode(prefix: string, lastCode?: string | null) {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const match = lastCode?.match(pattern);
  const width = match?.[1]?.length ?? 4;
  const nextNumber = match ? Number(match[1]) + 1 : 1;

  return `${prefix}-${String(nextNumber).padStart(width, "0")}`;
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
