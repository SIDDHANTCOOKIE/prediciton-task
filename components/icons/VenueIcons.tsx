// Real official logomarks, sourced from each venue's own public brand assets — used here purely
// to identify which venue a trader is on (standard nominative use, same as a payment icon), not
// to imply endorsement or affiliation.
//
// Polymarket: icon-only mark extracted from the official wordmark SVG published at
// polymarket.com/brand (mirrored, public-domain-simple-shape, on Wikimedia Commons:
// https://upload.wikimedia.org/wikipedia/commons/e/ec/Polymarket.svg — the diamond/hex glyph is
// the second <path> in that file, isolated here with its own tight viewBox).
//
// Kalshi: "K" glyph extracted from Kalshi's own wordmark SVG (served directly by kalshi.com,
// mirrored on Wikimedia Commons: https://upload.wikimedia.org/wikipedia/commons/e/ee/Kalshi_logo.svg
// — public domain, simple geometric/text shape). Brand green #21c891 confirmed from that same file.

export function PolymarketIcon({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 137 168" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M136.267 152.495C136.267 159.76 136.267 163.392 133.891 165.192C131.516 166.993 128.019 166.012 121.024 164.049L8.63192 132.51C4.41793 131.328 2.31093 130.737 1.09248 129.129C-0.125977 127.522 -0.125977 125.333 -0.125977 120.957V47.0434C-0.125977 42.6667 -0.125977 40.4783 1.09248 38.8709C2.31093 37.2634 4.41792 36.6722 8.63191 35.4897L121.024 3.95096C128.019 1.98834 131.516 1.00703 133.891 2.80771C136.267 4.60839 136.267 8.24049 136.267 15.5047V152.495ZM27.9043 122.228L120.966 148.345V96.1133L27.9043 122.228ZM15.1738 110.111L108.217 84L15.1738 57.8887V110.111ZM27.9033 45.7725L120.966 71.8877V19.6553L27.9033 45.7725Z"
      />
    </svg>
  );
}

export function KalshiIcon({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M0.416887 0.0221237H4.73849V8.99348L12.818 0.0221237H18.0582L10.6468 8.24586L18.5384 20H13.3608L7.59868 11.5686L4.73849 14.7459V20H0.416887V0.0221237Z"
      />
    </svg>
  );
}
