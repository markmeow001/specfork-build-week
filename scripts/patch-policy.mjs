export const ALLOWED_TARGET = "export-service.mjs";
export const MAX_PATCH_BYTES = 5000;

export function reviewPatch(proposal) {
  const violations = [];
  const content = typeof proposal?.content === "string" ? proposal.content : "";
  const bytes = new TextEncoder().encode(content).byteLength;

  if (proposal?.target !== ALLOWED_TARGET) violations.push("target-not-allowed");
  if (bytes > MAX_PATCH_BYTES) violations.push("patch-too-large");
  if (!/export\s+async\s+function\s+exportReport\s*\(/.test(content)) {
    violations.push("required-export-missing");
  }

  const imports = [
    ...content.matchAll(/(?:from\s+|\bimport\s*)["']([^"']+)["']/g),
  ].map((match) => match[1]);
  if (imports.some((specifier) => specifier !== "./report-data.mjs")) {
    violations.push("import-not-allowed");
  }

  // Reject source obfuscation. A data-export patch has no legitimate reason to
  // contain unicode/hex escape sequences, and they are the standard way to hide
  // a forbidden identifier from a text scan (`eval` resolves to `eval`,
  // `["constructor"]` to `constructor`). Blocking them keeps the
  // identifier denylist below meaningful.
  if (/\\u\{?[0-9a-fA-F]/.test(content) || /\\x[0-9a-fA-F]{2}/.test(content)) {
    violations.push("obfuscated-source");
  }

  // Defense-in-depth pre-filter for ACCIDENTAL / naive violations only. This is
  // NOT a security boundary: a determined adversary can defeat any source-text
  // denylist. Untrusted patches are therefore executed solely inside the
  // hardened container (--network none, --read-only, --cap-drop ALL, non-root,
  // digest-pinned image), which is the real trust boundary. Patterns match bare
  // identifiers (not just call/dot forms) so simple aliasing such as
  // `const p = process` is still flagged.
  const forbidden = [
    [/\b(?:eval|Function)\b/, "dynamic-execution"],
    [/\bprocess\b/, "process-access"],
    [/\b(?:fetch|WebSocket|XMLHttpRequest)\b/, "network-access"],
    [/\b(?:child_process|node:fs|node:net|node:http|node:https|node:dgram|node:vm|node:worker_threads|node:os|node:module|node:inspector)\b/, "privileged-module"],
    [/\bimport\s*\(/, "dynamic-import"],
    [/\brequire\b/, "commonjs-loader"],
    [/\b(?:globalThis|constructor|__proto__|Reflect|Proxy|WebAssembly)\b/, "global-access"],
  ];
  for (const [pattern, code] of forbidden) {
    if (pattern.test(content)) violations.push(code);
  }

  return {
    ...proposal,
    content,
    accepted: violations.length === 0,
    violations,
    bytes,
  };
}
