/** Original mark — an upward-trending "signal" inside a rounded square, evoking a market that
 *  resolves correctly. Colors are theme-aware (var(--accent)) so it works in light and dark. Not
 *  a reproduction of any third-party logo; swap the palette in app/globals.css's --accent once
 *  final brand colors are confirmed. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Elcara Predictor logo">
      <rect x={1} y={1} width={30} height={30} rx={9} fill="var(--accent)" />
      <path
        d="M8 21 L13 15 L17 18 L24 9"
        fill="none"
        stroke="var(--bg-card)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={24} cy={9} r={2.1} fill="var(--bg-card)" />
    </svg>
  );
}

export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      {withWordmark && <span className="text-[15px] font-semibold tracking-tight text-text">Elcara Predictor</span>}
    </div>
  );
}
