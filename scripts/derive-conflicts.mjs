/**
 * Derive the set of observable conflicts from executed branch results.
 *
 * A conflict is a `${phase}.${field}` observation on which the branches do
 * NOT all agree. Every scenario/field pair is counted independently, so the
 * count reflects exactly what the executed branches disagree on — it is never
 * a hand-curated list. This is the core SpecFork claim ("independent
 * implementations diverge on N observable behaviors"), so it must always be
 * computed from real data.
 *
 * @param {ReadonlyArray<{ normal?: Record<string, unknown>; large?: Record<string, unknown> }>} branches
 * @returns {string[]} sorted conflict keys, e.g. ["normal.scope", "large.delivery"]
 */
export function deriveConflicts(branches) {
  if (!Array.isArray(branches) || branches.length === 0) {
    return [];
  }

  const phases = ["normal", "large"];
  const conflicts = [];

  for (const phase of phases) {
    const fields = new Set();
    for (const branch of branches) {
      for (const field of Object.keys(branch?.[phase] ?? {})) {
        fields.add(field);
      }
    }

    for (const field of fields) {
      const values = branches.map((branch) =>
        JSON.stringify(branch?.[phase]?.[field] ?? null),
      );
      const unanimous = values.every((value) => value === values[0]);
      if (!unanimous) {
        conflicts.push(`${phase}.${field}`);
      }
    }
  }

  return conflicts;
}
