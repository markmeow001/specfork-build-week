import { reportView } from "./report-data.mjs";

export async function exportReport() {
  return {
    scope: reportView.visibleRowIds.length,
    format: "pdf",
    filter: "visible-state",
    delivery: "preview",
    includesCharts: true,
  };
}
