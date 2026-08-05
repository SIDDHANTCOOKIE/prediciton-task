function Box({ x, y, w, h, label, sub, accent = false }: { x: number; y: number; w: number; h: number; label: string; sub?: string; accent?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill="var(--bg-card)"
        stroke={accent ? "var(--accent)" : "var(--border)"}
        strokeWidth={accent ? 1.5 : 1}
      />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -4 : 5)} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text)">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize={10} fill="var(--text-faint)">
          {sub}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <defs>
        <marker id="arrowhead-sys" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-faint)" />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-faint)" strokeWidth={1.3} markerEnd="url(#arrowhead-sys)" />
      {label && (
        <text x={midX} y={midY - 6} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">
          {label}
        </text>
      )}
    </g>
  );
}

/** The whole system, top to bottom: viewer's browser never talks to Polymarket/Kalshi directly —
 *  only our own backend does. This is the diagram for "why is there a separate backend at all". */
export function SystemDiagram() {
  return (
    <svg viewBox="0 0 720 380" className="w-full max-w-2xl" role="img" aria-label="System architecture diagram">
      <Box x={20} y={20} w={190} h={54} label="Your browser" sub="India, anywhere" />
      <Box x={265} y={20} w={190} h={54} label="Frontend (Vercel)" sub="Next.js — this UI" accent />
      <Arrow x1={210} y1={47} x2={265} y2={47} label="loads page" />

      <Arrow x1={360} y1={74} x2={360} y2={130} label="reads snapshot" />
      <Box x={265} y={130} w={190} h={60} label="Backend (Render)" sub="always-on, US region" accent />

      <Arrow x1={455} y1={160} x2={560} y2={160} label="reads only" />
      <Box x={560} y={130} w={140} h={60} label="Postgres" sub="stored snapshots" />

      <Arrow x1={360} y1={190} x2={360} y2={250} label="fetches (ingest)" />
      <Box x={220} y={250} w={160} h={60} label="Polymarket" sub="public data API" />
      <Box x={400} y={250} w={160} h={60} label="Kalshi" sub="best-effort" />
      <Arrow x1={340} y1={250} x2={300} y2={310} label="" />
      <Arrow x1={380} y1={250} x2={420} y2={310} label="" />

      <Box x={220} y={330} w={340} h={40} label="External pinger (UptimeRobot / cron-job.org)" sub="" />
      <Arrow x1={390} y1={330} x2={390} y2={192} label="wakes + triggers ingest" />

      <text x={20} y={370} fontSize={9.5} fill="var(--text-faint)">
        Key idea: the browser only ever calls the Frontend, which only ever calls the Backend, which is the only thing that talks to Polymarket/Kalshi.
      </text>
    </svg>
  );
}
