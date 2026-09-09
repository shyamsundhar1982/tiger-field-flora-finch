export function requireArrayResponse<T>(value: unknown, message: string): T[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value as T[];
}

export function requireRecordResponse<T extends object>(value: unknown, message: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as T;
}
