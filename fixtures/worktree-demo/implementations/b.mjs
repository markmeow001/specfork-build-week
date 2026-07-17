import { reportRows, reportView } from "./report-data.mjs";

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
