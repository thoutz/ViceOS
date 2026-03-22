/**
 * Normalizes portrait / studio backdrop from JSON bodies (camelCase and snake_case).
 * Trims strings; empty string becomes `null` so the DB clears the column.
 * Call after other body fields are merged into `updates`.
 */
export function mergeCharacterImageUrlFields(
  body: Record<string, unknown>,
  updates: Record<string, unknown>,
): void {
  const trimText = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = typeof v === "string" ? v : String(v);
    const t = s.trim();
    return t === "" ? null : t;
  };

  if (Object.hasOwn(body, "avatarUrl")) {
    updates.avatarUrl = trimText(body.avatarUrl);
  }
  if (Object.hasOwn(body, "avatar_url")) {
    updates.avatarUrl = trimText(body.avatar_url);
  }
  if (Object.hasOwn(body, "sheetBackgroundUrl")) {
    updates.sheetBackgroundUrl = trimText(body.sheetBackgroundUrl);
  }
  if (Object.hasOwn(body, "sheet_background_url")) {
    updates.sheetBackgroundUrl = trimText(body.sheet_background_url);
  }
}

/** Remove keys whose value is `undefined` so Drizzle does not skip intended writes. */
export function omitUndefinedKeys<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out as T;
}
