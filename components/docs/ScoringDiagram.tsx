function Step({ x, y, w, h, label, sub }: { x: number; y: number; w: number; h: number; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={9} fill="var(--bg-card)" stroke="var(--border)" />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -3 : 4)} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--text)">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={9.5} fill="var(--text-faint)">
          {sub}
        </text>
      )}
    </g>
  );
}

function RightArrow({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <defs>
        <marker id="arrowhead-score" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
        </marker>
      </defs>
      <line x1={x} y1={y} x2={x + 26} y2={y} stroke="var(--accent)" strokeWidth={1.5} markerEnd="url(#arrowhead-score)" />
    </g>
  );
}

/** The event-to-score pipeline: this is the fix for the old "buy-and-hold winners look like
 *  losers" bug — REDEEM events (on-chain resolution payouts) are counted, not just CLOB trades. */
export function ScoringDiagram() {
  return (
    <svg viewBox="0 0 760 200" className="w-full max-w-3xl" role="img" aria-label="Scoring pipeline diagram">
      <Step x={0} y={20} w={130} h={50} label="On-chain events" sub="TRADE / REDEEM / REWARD" />
      <RightArrow x={130} y={45} />

      <Step x={160} y={20} w={130} h={50} label="Daily cash flow" sub="one delta per day" />
      <RightArrow x={290} y={45} />

      <Step x={320} y={20} w={140} h={50} label="Reconcile" sub="vs. official leaderboard PnL" />
      <RightArrow x={460} y={45} />

      <Step x={490} y={20} w={130} h={50} label="Risk metrics" sub="Sharpe · Sortino · drawdown" />
      <RightArrow x={620} y={45} />

      <Step x={650} y={20} w={100} h={50} label="Score + Tier" sub="0–100, Elite→Risky" />

      <text x={0} y={110} fontSize={11} fill="var(--text-muted)">
        REDEEM is the fix: a trader who buys and holds until a market resolves gets paid out on-chain — that
      </text>
      <text x={0} y={128} fontSize={11} fill="var(--text-muted)">
        payout is a REDEEM event, not a trade. Counting only trades made real winners look like losers.
      </text>
      <text x={0} y={155} fontSize={10} fill="var(--text-faint)">
        "Reconcile" step: if our rebuilt total P&amp;L doesn&apos;t match the venue&apos;s official number closely enough, the row
      </text>
      <text x={0} y={170} fontSize={10} fill="var(--text-faint)">
        is flagged "low confidence" instead of silently trusting a possibly-wrong curve.
      </text>
    </svg>
  );
}
