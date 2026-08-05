import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elcara Predictor — Prediction Market Efficiency Leaderboard",
    template: "%s · Elcara Predictor",
  },
  description:
    "Elcara Predictor ranks Polymarket and Kalshi traders by risk-adjusted efficiency — Sharpe, Sortino, drawdown, and win rate — not just raw P&L.",
};

const THEME_INIT_SCRIPT = `
try {
  var stored = localStorage.getItem('theme');
  var theme = stored === 'light' || stored === 'dark' ? stored : null;
  if (theme) document.documentElement.setAttribute('data-theme', theme);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
