import { reportRows } from "./report-data.mjs";

// Agent A deliberately returns a DIFFERENT internal shape from Agent B/C
// (rowCount / mimeType / filterApplied / download instead of the explicit
// scope/format/filter/delivery fields). This proves the contract tests bind to
// the normalized OBSERVABLE behavior, not to any one internal data format — the
// whole point of normalize-export.mjs. Do not "simplify" this back to the
// explicit shape; that would silently stop exercising the decoupling layer.
export async function exportReport({ largeDataset = false } = {}) {
  return {
    rowCount: largeDataset ? 25000 : reportRows.length,
    mimeType: "text/csv",
    filterApplied: false,
    download: true,
  };
}
