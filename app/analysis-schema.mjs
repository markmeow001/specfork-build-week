/**
 * @typedef {{
 *   summary: string,
 *   disagreement: string[],
 *   forks: Array<{
 *     id: string,
 *     label: string,
 *     intent: string,
 *     behavior: string[],
 *     tests: number,
 *     artifact: string,
 *   }>,
 *   question: {
 *     prompt: string,
 *     options: Array<{ id: string, label: string, resolves: string }>,
 *   },
 * }} AnalysisPayload
 */

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value, minimum, maximum) {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.every(isNonEmptyString)
  );
}

/**
 * Treat model output as untrusted input. Returns the validated payload or null
 * so callers can fall back to the credential-free deterministic demo.
 *
 * @param {unknown} value
 * @returns {AnalysisPayload | null}
 */
export function parseAnalysisPayload(value) {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.summary)) return null;
  if (!isStringArray(value.disagreement, 2, 5)) return null;
  if (!Array.isArray(value.forks) || value.forks.length !== 3) return null;

  const expectedForkIds = ["a", "b", "c"];
  for (const [index, fork] of value.forks.entries()) {
    if (!isRecord(fork) || fork.id !== expectedForkIds[index]) return null;
    if (
      !isNonEmptyString(fork.label) ||
      !isNonEmptyString(fork.intent) ||
      !isStringArray(fork.behavior, 4, 4) ||
      !Number.isInteger(fork.tests) ||
      fork.tests < 0 ||
      !isNonEmptyString(fork.artifact)
    ) {
      return null;
    }
  }

  if (!isRecord(value.question) || !isNonEmptyString(value.question.prompt)) {
    return null;
  }
  if (
    !Array.isArray(value.question.options) ||
    value.question.options.length !== 3
  ) {
    return null;
  }

  const optionIds = new Set();
  for (const option of value.question.options) {
    if (
      !isRecord(option) ||
      !isNonEmptyString(option.id) ||
      !isNonEmptyString(option.label) ||
      !isNonEmptyString(option.resolves) ||
      optionIds.has(option.id)
    ) {
      return null;
    }
    optionIds.add(option.id);
  }

  return /** @type {AnalysisPayload} */ (value);
}
