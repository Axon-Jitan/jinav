// Removes volatile reference metadata for no-progress comparisons.
export function observationFingerprint(text: string): string {
  try {
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .filter(
              ([key]) => !["snapshot_id", "ref_id", "ref_count"].includes(key),
            )
            .map(([key, item]) => [key, normalize(item)]),
        );
      return value;
    };
    return JSON.stringify(normalize(JSON.parse(text)));
  } catch {
    return text;
  }
}
