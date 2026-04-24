export function normalizeEnvValue(value?: string | null) {
  if (!value) return '';

  let normalized = String(value).trim();

  for (let i = 0; i < 2; i += 1) {
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1).trim();
      continue;
    }
    break;
  }

  normalized = normalized.replace(/\\r/g, '\r').replace(/\\n/g, '\n').trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}
