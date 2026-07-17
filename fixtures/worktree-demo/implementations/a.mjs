import { reportRows } from "./report-data.mjs";

export async function exportReport({ largeDataset = false } = {}) {
  return {
    scope: largeDataset ? 25000 : reportRows.length,
    format: "csv",
    filter: "ignored",
    delivery: "immediate",
    includesCharts: false,
  };
}
