export function CompareBar({ count, onOpen, onClear }: { count: number; onOpen: () => void; onClear: () => void }) {
  if (count < 1) return null;
  return (
    <div className="animate-fade-in-up fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-bg-elevated px-4 py-2.5 shadow-2xl">
      <span className="text-sm font-medium text-text">
        {count} trader{count > 1 ? "s" : ""} selected
      </span>
      <button
        onClick={onOpen}
        disabled={count < 2}
        className="rounded-full bg-text px-3.5 py-1.5 text-sm font-medium text-bg transition-opacity disabled:opacity-40"
      >
        Compare
      </button>
      <button onClick={onClear} className="text-sm text-text-faint transition-colors hover:text-text">
        Clear
      </button>
    </div>
  );
}
