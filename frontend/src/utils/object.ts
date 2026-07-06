export function getValueByPath(record: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
}

export function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "string") {
    const parsedDate = Date.parse(value);
    if (
      !Number.isNaN(parsedDate) &&
      /^\d{4}-\d{2}-\d{2}T/.test(value)
    ) {
      return new Date(value).toLocaleString();
    }
    return value;
  }
  return JSON.stringify(value);
}

export function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, item]) => {
    if (item !== "" && item !== undefined) {
      result[key] = item;
    }
    return result;
  }, {});
}
