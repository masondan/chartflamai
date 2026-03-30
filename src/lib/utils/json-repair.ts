export function repairJson(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Remove any leading text before the first { or [
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  if (start > 0) {
    cleaned = cleaned.substring(start);
  }

  // Remove trailing text after the last } or ]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end >= 0 && end < cleaned.length - 1) {
    cleaned = cleaned.substring(0, end + 1);
  }

  // Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Fix unescaped newlines in strings (basic)
  cleaned = cleaned.replace(/(?<=": "(?:[^"\\]|\\.)*)(?:\r?\n)(?=(?:[^"\\]|\\.)*")/g, '\\n');

  return cleaned;
}

export function safeJsonParse<T>(raw: string): T {
  try {
    return JSON.parse(raw);
  } catch {
    const repaired = repairJson(raw);
    return JSON.parse(repaired);
  }
}
