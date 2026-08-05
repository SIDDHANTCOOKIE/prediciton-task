export type DocsNavGroup = {
  label: string;
  items: { id: string; label: string }[];
};

export const DOCS_NAV: DocsNavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "methodology-overview", label: "Methodology Overview" },
      { id: "big-picture", label: "System Architecture" },
    ],
  },
  {
    label: "Architecture",
    items: [
      { id: "why-backend", label: "Decoupled Data Ingestion" },
      { id: "score", label: "Quantitative Scoring Pipeline" },
      { id: "freshness", label: "Data Synchronization Strategy" },
    ],
  },
  {
    label: "Using the leaderboard",
    items: [{ id: "filters", label: "Data Confidence & Filtering" }],
  },
  {
    label: "Reference",
    items: [
      { id: "decisions", label: "Architectural Tradeoffs" },
      { id: "stack", label: "Technology Stack" },
    ],
  },
];
