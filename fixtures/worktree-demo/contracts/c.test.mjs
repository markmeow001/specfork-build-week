import assert from "node:assert/strict";
import test from "node:test";
import { exportReport } from "./export-service.mjs";
import { normalizeExportResult } from "./normalize-export.mjs";

test("renders the visible report as a previewable PDF", async () => {
  const result = normalizeExportResult(await exportReport());
  assert.deepEqual(result, {
    scope: 1,
    format: "pdf",
    filter: "visible-state",
    delivery: "preview",
    includesCharts: true,
  });
});
