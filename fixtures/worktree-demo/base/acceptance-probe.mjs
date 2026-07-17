import { exportReport } from "./export-service.mjs";
import { normalizeExportResult } from "./normalize-export.mjs";

const result = normalizeExportResult(await exportReport({
  largeDataset: process.argv.includes("--large"),
}));

// Sign the result with the harness-supplied per-run token so the runner can
// distinguish this genuine line from any `{...}` output printed by the exported
// code itself. Untrusted patch code cannot read this token (the policy gate
// blocks process access), so it cannot forge a matching line.
const tokenArg = process.argv.find((arg) => arg.startsWith("--probe-token="));
const token = tokenArg ? tokenArg.slice("--probe-token=".length) : "";

process.stdout.write(`${token} ${JSON.stringify(result)}\n`);
