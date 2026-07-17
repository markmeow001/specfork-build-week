import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeExportResult } from "../fixtures/worktree-demo/base/normalize-export.mjs";

const implSource = (id) =>
  readFileSync(
    new URL(
      `../fixtures/worktree-demo/implementations/${id}.mjs`,
      import.meta.url,
    ),
    "utf8",
  );

test("infers scope from scope, rowCount, or rows[]", () => {
  assert.equal(normalizeExportResult({ scope: 4, format: "csv" }).scope, 4);
  assert.equal(
    normalizeExportResult({ rowCount: 25000, format: "csv" }).scope,
    25000,
  );
  assert.equal(
    normalizeExportResult({ rows: [1, 2, 3], format: "csv" }).scope,
    3,
  );
});

test("infers format from format, filename extension, or mimeType", () => {
  assert.equal(normalizeExportResult({ format: "CSV" }).format, "csv");
  assert.equal(normalizeExportResult({ filename: "report.pdf" }).format, "pdf");
  assert.equal(normalizeExportResult({ mimeType: "text/csv" }).format, "csv");
  assert.equal(
    normalizeExportResult({ mimeType: "application/pdf" }).format,
    "pdf",
  );
});

test("infers filter from filter, filterApplied, or viewport/visibleState", () => {
  assert.equal(
    normalizeExportResult({ filter: "preserved" }).filter,
    "preserved",
  );
  assert.equal(
    normalizeExportResult({ filterApplied: true }).filter,
    "preserved",
  );
  assert.equal(
    normalizeExportResult({ filterApplied: false }).filter,
    "ignored",
  );
  assert.equal(
    normalizeExportResult({ viewport: true }).filter,
    "visible-state",
  );
  assert.equal(
    normalizeExportResult({ visibleState: true }).filter,
    "visible-state",
  );
});

test("infers delivery from delivery, backgroundJob/queued, preview, or download", () => {
  assert.equal(
    normalizeExportResult({ delivery: "immediate" }).delivery,
    "immediate",
  );
  assert.equal(
    normalizeExportResult({ backgroundJob: true }).delivery,
    "background-job",
  );
  assert.equal(
    normalizeExportResult({ queued: true }).delivery,
    "background-job",
  );
  assert.equal(
    normalizeExportResult({ previewUrl: "/x" }).delivery,
    "preview",
  );
  assert.equal(normalizeExportResult({ preview: true }).delivery, "preview");
  assert.equal(normalizeExportResult({ download: true }).delivery, "immediate");
});

test("infers includesCharts from includesCharts, includeCharts, or charts[]", () => {
  assert.equal(
    normalizeExportResult({ includesCharts: true, format: "pdf" }).includesCharts,
    true,
  );
  assert.equal(
    normalizeExportResult({ includeCharts: true, format: "pdf" }).includesCharts,
    true,
  );
  assert.equal(
    normalizeExportResult({ charts: ["a"], format: "pdf" }).includesCharts,
    true,
  );
  assert.equal(
    normalizeExportResult({ charts: [], format: "pdf" }).includesCharts,
    false,
  );
});

test("rejects non-object results", () => {
  assert.throws(() => normalizeExportResult(null), TypeError);
  assert.throws(() => normalizeExportResult("nope"), TypeError);
});

test("the three implementations stay internally divergent (regression guard for M4)", () => {
  const a = implSource("a");
  const b = implSource("b");
  const c = implSource("c");

  // Agent A must use the alternate scope/format branch (rowCount + mimeType),
  // Agent C the array/url branch (rows + filename/previewUrl), Agent B the
  // explicit shape. If any of these is "simplified" back to the explicit shape
  // the decoupling layer stops being exercised end-to-end — see a.mjs/c.mjs.
  assert.ok(a.includes("rowCount") && a.includes("mimeType"), "A lost its alternate shape");
  assert.ok(c.includes("rows:") && c.includes("filename"), "C lost its alternate shape");
  assert.ok(b.includes("scope:") && b.includes("delivery:"), "B lost its explicit shape");

  // And the alternate shapes really do normalize to the expected contract.
  assert.deepEqual(
    normalizeExportResult({
      rowCount: 4,
      mimeType: "text/csv",
      filterApplied: false,
      download: true,
    }),
    { scope: 4, format: "csv", filter: "ignored", delivery: "immediate", includesCharts: false },
  );
  assert.deepEqual(
    normalizeExportResult({
      rows: [1],
      filename: "report-preview.pdf",
      viewport: true,
      previewUrl: "/exports/report-preview",
      charts: ["Revenue by region", "Monthly trend"],
    }),
    { scope: 1, format: "pdf", filter: "visible-state", delivery: "preview", includesCharts: true },
  );
});
