import { exportReport } from "./export-service.mjs";
import { normalizeExportResult } from "./normalize-export.mjs";

const result = normalizeExportResult(await exportReport({
  largeDataset: process.argv.includes("--large"),
}));

process.stdout.write(`${JSON.stringify(result)}\n`);
