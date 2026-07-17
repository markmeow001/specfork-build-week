import { reportRows, reportView } from "./report-data.mjs";

// Agent B intentionally uses the explicit normalized shape so the fixture keeps
// covering the primary inference branch, while Agent A/C exercise the alternate
// shapes. Keep the three implementations internally divergent on purpose.
export async function exportReport({ largeDataset = false } = {}) {
  const filtered = reportRows.filter(
    (row) => row.region === reportView.activeFilter.region,
  );

  return {
    scope: largeDataset ? 25000 : filtered.length,
    format: "csv",
    filter: "preserved",
    delivery: largeDataset ? "background-job" : "immediate",
    includesCharts: false,
  };
}
