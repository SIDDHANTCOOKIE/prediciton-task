function Node({ x, y, w, h, label, sub }: { x: number; y: number; w: number; h: number; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={9} fill="var(--bg-card)" stroke="var(--border)" />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -3 : 4)} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={9} fill="var(--text-faint)">
          {sub}
        </text>
      )}
    </g>
  );
}

function DownArrow({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <defs>
        <marker id="arrowhead-fresh" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto">
          <path d="M0,0 L8,0 L4,8 Z" fill="var(--text-faint)" />
        </marker>
      </defs>
      <line x1={x} y1={y} x2={x} y2={y + 26} stroke="var(--text-faint)" strokeWidth={1.3} markerEnd="url(#arrowhead-fresh)" />
      {label && (
        <text x={x + 8} y={y + 16} fontSize={9} fill="var(--text-muted)">
          {label}
        </text>
      )}
    </g>
  );
}

/** Why an external pinger, not just an internal cron job: Render's free tier sleeps the
 *  process after ~15 min idle, and a sleeping process can't run its own scheduler. */
export function FreshnessDiagram() {
  return (
    <svg viewBox="0 0 620 260" className="w-full max-w-xl" role="img" aria-label="Keep-alive and freshness diagram">
      <Node x={210} y={10} w={200} h={46} label="External pinger" sub="UptimeRobot / cron-job.org" />
      <DownArrow x={310} y={56} label="every 5–10 min" />
      <Node x={210} y={92} w={200} h={46} label="Backend (Render)" sub="wakes up if asleep" />
      <DownArrow x={310} y={138} label="GET /health · POST /ingest" />
      <Node x={130} y={174} w={160} h={46} label="Stays warm" sub="GET /health" />
      <Node x={330} y={174} w={160} h={46} label="Refreshes data" sub="POST /ingest" />

      <text x={20} y={240} fontSize={10} fill="var(--text-faint)">
        Without the pinger, a free instance falls asleep and its own internal scheduler never fires — the
      </text>
      <text x={20} y={254} fontSize={10} fill="var(--text-faint)">
        site would look alive but silently stop refreshing. The pinger is the real scheduler.
      </text>
    </svg>
  );
}
