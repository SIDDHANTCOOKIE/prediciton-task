export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Elcara Predictor logo">
      <defs>
        <linearGradient id="grad-top" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="grad-left" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="grad-right" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      {/* Top Face */}
      <polygon points="50,10 84.64,30 50,50 15.36,30" fill="url(#grad-top)" />
      {/* Left Face */}
      <polygon points="15.36,30 50,50 50,90 15.36,70" fill="url(#grad-left)" />
      {/* Right Face */}
      <polygon points="84.64,30 84.64,70 50,90 50,50" fill="url(#grad-right)" />
      
      {/* Trend Line */}
      <path
        d="M30,65 L45,50 L55,55 L75,30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="75" cy="30" r="4" fill="#FFFFFF" />
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
