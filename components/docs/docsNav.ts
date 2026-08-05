export type DocsNavGroup = {
  label: string;
  items: { id: string; label: string }[];
};

export const DOCS_NAV: DocsNavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "like-im-2", label: "Explain it like I'm 2" },
      { id: "big-picture", label: "The big picture" },
    ],
  },
  {
    label: "Architecture",
    items: [
      { id: "why-backend", label: "Why a separate backend?" },
      { id: "score", label: "How the score is built" },
      { id: "freshness", label: "Staying fresh, staying up" },
    ],
  },
  {
    label: "Using the leaderboard",
    items: [{ id: "filters", label: "Filters & confidence" }],
  },
  {
    label: "Reference",
    items: [
      { id: "decisions", label: "Decisions & tradeoffs" },
      { id: "stack", label: "Tech stack" },
    ],
  },
];
