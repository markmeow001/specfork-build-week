import assert from "node:assert/strict";
import test from "node:test";
import { exportReport } from "./export-service.mjs";
import { normalizeExportResult } from "./normalize-export.mjs";

test("exports all accessible data as an immediate CSV", async () => {
  const result = normalizeExportResult(await exportReport());
  assert.deepEqual(result, {
    scope: 4,
    format: "csv",
    filter: "ignored",
    delivery: "immediate",
    includesCharts: false,
  });
});
