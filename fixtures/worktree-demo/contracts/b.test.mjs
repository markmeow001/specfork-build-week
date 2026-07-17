import assert from "node:assert/strict";
import test from "node:test";
import { exportReport } from "./export-service.mjs";
import { normalizeExportResult } from "./normalize-export.mjs";

test("exports the filtered result set and queues large jobs", async () => {
  const result = normalizeExportResult(
    await exportReport({ largeDataset: true }),
  );
  assert.deepEqual(result, {
    scope: 25000,
    format: "csv",
    filter: "preserved",
    delivery: "background-job",
    includesCharts: false,
  });
});
