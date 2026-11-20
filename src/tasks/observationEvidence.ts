// Matches exact observation text, decoding JSON string escaping without fuzzy matching.
export function observationEvidence(text: string, evidence: string): boolean {
  if (!evidence.trim()) return false;
  if (text.includes(evidence)) return true;
  const contains = (value: unknown): boolean => {
    if (typeof value === "string") return value.includes(evidence);
    if (Array.isArray(value)) return value.some(contains);
    if (value && typeof value === "object")
      return Object.values(value).some(contains);
    return false;
  };
  try {
    return contains(JSON.parse(text));
  } catch {
    return false;
  }
}
