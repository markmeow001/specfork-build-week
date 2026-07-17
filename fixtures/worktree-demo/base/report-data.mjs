export const reportRows = [
  { id: 1, region: "Canada", amount: 120 },
  { id: 2, region: "United States", amount: 90 },
  { id: 3, region: "Canada", amount: 210 },
  { id: 4, region: "France", amount: 75 },
];

export const reportView = {
  activeFilter: { region: "Canada" },
  visibleRowIds: [1],
  sortedRowIds: [3, 1],
  charts: ["Revenue by region", "Monthly trend"],
  branding: "Northstar Analytics",
};
