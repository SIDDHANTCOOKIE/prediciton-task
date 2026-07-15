export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 sm:px-6">
          <div className="skeleton h-4 w-4 rounded" />
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="skeleton h-3.5 w-28 rounded" />
            <div className="skeleton h-2.5 w-20 rounded" />
          </div>
          <div className="skeleton h-6 w-12 rounded-md" />
          <div className="skeleton h-3.5 w-14 rounded" />
          <div className="skeleton hidden h-3.5 w-16 rounded sm:block" />
        </div>
      ))}
    </div>
  );
}
