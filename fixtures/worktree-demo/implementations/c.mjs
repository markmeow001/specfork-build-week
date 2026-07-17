import { reportView } from "./report-data.mjs";

// Agent C also uses a DIFFERENT internal shape (rows[] / filename / viewport /
// previewUrl / charts[]) that normalize-export.mjs maps to the same observable
// contract. Together with Agent A this exercises the alternate inference
// branches, while Agent B keeps the explicit shape — so the fixture proves the
// decoupling works for every internal representation, not just one.
export async function exportReport() {
  return {
    rows: reportView.visibleRowIds,
    filename: "report-preview.pdf",
    viewport: true,
    previewUrl: "/exports/report-preview",
    charts: reportView.charts,
  };
}
