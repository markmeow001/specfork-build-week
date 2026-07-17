function inferFormat(result) {
  if (typeof result.format === "string") return result.format.toLowerCase();
  if (typeof result.filename === "string" && result.filename.includes(".")) {
    return result.filename.split(".").at(-1).toLowerCase();
  }
  if (typeof result.mimeType === "string") {
    if (result.mimeType.includes("csv")) return "csv";
    if (result.mimeType.includes("pdf")) return "pdf";
  }
  return "unknown";
}

function inferFilter(result) {
  if (typeof result.filter === "string") return result.filter;
  if (result.filterApplied === true) return "preserved";
  if (result.filterApplied === false) return "ignored";
  if (result.visibleState === true || result.viewport === true) {
    return "visible-state";
  }
  return "unknown";
}

function inferDelivery(result) {
  if (typeof result.delivery === "string") return result.delivery;
  if (result.backgroundJob === true || result.queued === true) {
    return "background-job";
  }
  if (result.preview === true || result.previewUrl) return "preview";
  if (result.download === true || result.filename) return "immediate";
  return "unknown";
}

export function normalizeExportResult(result) {
  if (!result || typeof result !== "object") {
    throw new TypeError("exportReport must return an object.");
  }

  return {
    scope:
      result.scope ??
      result.rowCount ??
      (Array.isArray(result.rows) ? result.rows.length : undefined),
    format: inferFormat(result),
    filter: inferFilter(result),
    delivery: inferDelivery(result),
    includesCharts:
      result.includesCharts ??
      result.includeCharts ??
      (Array.isArray(result.charts) ? result.charts.length > 0 : false),
  };
}
