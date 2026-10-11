// Small checks for unknown JSON. Each one returns the value or throws an error that names the field.
export type Fields = Record<string, unknown>;

export const fail = (path: string, problem: string): never => {
  throw new Error(`${path} ${problem}`);
};

export const record = (value: unknown, path: string): Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : fail(path, "is not an object");

export const list = (value: unknown, path: string): unknown[] => (Array.isArray(value) ? value : fail(path, "is not a list"));

export const text = (value: unknown, path: string): string =>
  typeof value === "string" && value.trim() ? value : fail(path, "is not a nonempty string");

export const flag = (value: unknown, path: string): boolean => (typeof value === "boolean" ? value : fail(path, "is not a boolean"));

export const number = (value: unknown, path: string, min = -Infinity, max = Infinity): number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fail(path, `is not a number from ${min} to ${max}`);

export const nullableNumber = (value: unknown, path: string, min?: number): number | null => (value === null ? null : number(value, path, min));

export const count = (value: unknown, path: string): number => (Number.isInteger(number(value, path, 0)) ? (value as number) : fail(path, "is not a whole number"));
