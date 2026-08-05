import type { Metadata } from "next";
import { DocsTopBar } from "@/components/docs/DocsTopBar";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { SystemDiagram } from "@/components/docs/SystemDiagram";
import { ScoringDiagram } from "@/components/docs/ScoringDiagram";
import { FreshnessDiagram } from "@/components/docs/FreshnessDiagram";

export const metadata: Metadata = {
  title: "Docs",
  description: "How Elcara Predictor works, from scratch: architecture, data sources, and the efficiency score.",
};

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border-soft py-10 first:pt-0 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{eyebrow}</div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-text">
        <a href={`#${id}`} className="group inline-flex items-center gap-2">
          {title}
          <span className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--text-faint)" }}>
            #
          </span>
        </a>
      </h2>
      <div className="mt-3.5 space-y-3.5 text-[14.5px] leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--accent)", backgroundColor: "var(--accent-soft)", color: "var(--text)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-row-hover px-1.5 py-0.5 font-mono text-[0.85em] text-text">{children}</code>;
}

function DiagramCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center overflow-x-auto rounded-xl border border-border-soft p-5" style={{ backgroundColor: "var(--bg-card)" }}>
      {children}
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <DocsTopBar />
      <DocsMobileNav />

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 items-start gap-10 px-4 py-8 sm:px-6">
        <DocsSidebar />

        <main className="min-w-0 flex-1">
          <div className="mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">Technical documentation</div>
            <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-text">System Architecture & Methodology</h1>
            <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-text-muted">
              A comprehensive overview of the application architecture, data ingestion pipelines, and the quantitative scoring methodology used to evaluate trader performance.
            </p>
          </div>

          <Section id="methodology-overview" eyebrow="Overview" title="Methodology Overview">
            <p>
              Traditional prediction market leaderboards rank participants purely by absolute profit, inherently favoring
              those with the largest starting capital. Elcara Predictor aims to identify genuine trading skill by ranking 
              market participants according to risk-adjusted efficiency rather than raw portfolio size.
            </p>
            <p>
              By aggregating data from <strong>Polymarket</strong> and <strong>Kalshi</strong>, this platform computes
              comprehensive risk metrics to determine the most effective capital allocators. A trader who generates a 
              high relative return with low volatility will outrank a trader who simply risked a massive bankroll to 
              achieve a higher absolute return.
            </p>
          </Section>

          <Section id="big-picture" eyebrow="Overview" title="System Architecture">
            <p>
              The system architecture comprises three primary components: the client browser, the Next.js frontend application, and a dedicated backend ingestion service. Crucially, all data fetching and aggregation are handled exclusively by the backend; the client never interacts with the Polymarket or Kalshi APIs directly.
            </p>
            <DiagramCard>
              <SystemDiagram />
            </DiagramCard>
          </Section>

          <Section id="why-backend" eyebrow="Architecture" title="Decoupled Data Ingestion">
            <p>
              Direct client-to-API communication proved unreliable due to two primary network factors:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>DNS Resolution Inconsistencies:</strong> Regional ISPs frequently fail to resolve these specific API endpoints correctly, resulting in dead-end requests and timeouts. Relying on client-side fetching introduces unacceptable regional availability issues.
              </li>
              <li>
                <strong>Upstream Rate Limiting and Flakiness:</strong> The target APIs sit behind strict edge networks (Cloudflare/CloudFront), leading to sporadic TCP resets. 
              </li>
            </ul>
            <p>
              To ensure high availability, the dedicated backend service resolves external endpoints via secure DNS-over-HTTPS and implements robust retry logic. It persists the aggregated data into a PostgreSQL database, which serves as the highly available source of truth for the frontend application.
            </p>
            <Callout>
              In the event of an upstream API outage, the backend gracefully degrades by serving the most recent cached snapshot, ensuring continuous platform availability.
            </Callout>
          </Section>

          <Section id="score" eyebrow="Architecture" title="Quantitative Scoring Pipeline">
            <p>
              To mitigate the inherent bias of absolute profit (P&amp;L), the platform reconstructs each trader&apos;s chronological equity curve and calculates institutional-grade risk metrics (e.g., Sharpe ratio, Sortino ratio, maximum drawdown). These metrics are synthesized into a normalized 0–100 efficiency score and a corresponding performance tier.
            </p>
            <DiagramCard>
              <ScoringDiagram />
            </DiagramCard>
            <p>
              Because the upstream platforms only expose aggregate P&amp;L figures, the backend service rebuilds the equity curve from scratch by parsing the trader&apos;s public on-chain activity ledger (including trades, resolution payouts, and liquidity rewards).
            </p>
          </Section>

          <Section id="freshness" eyebrow="Architecture" title="Data Synchronization Strategy">
            <p>
              The backend service is hosted on a scaled-to-zero environment to optimize infrastructure costs. To prevent the service from sleeping and halting the data pipeline, an external scheduling service periodically pings a secured endpoint, triggering the ingestion cycle.
            </p>
            <DiagramCard>
              <FreshnessDiagram />
            </DiagramCard>
          </Section>

          <Section id="filters" eyebrow="Using the leaderboard" title="Data Confidence & Filtering">
            <p>
              <strong>Profitable only</strong> (enabled by default) selectively excludes traders with a negative cumulative P&amp;L.
            </p>
            <p>
              <strong>Low confidence</strong> traders exhibit a significant discrepancy between their upstream reported P&amp;L and our reconstructed equity curve, indicating that the derived risk metrics may be statistically inaccurate.
            </p>
            <p>
              This discrepancy typically occurs due to hard limits imposed by upstream APIs (e.g., Polymarket&apos;s 5,000 event limit per wallet), which truncates the historical data required for an accurate reconstruction. In these cases, the UI displays an informational icon to indicate an upstream data ceiling rather than an algorithmic failure.
            </p>
            <p>
              Ratio-based sorts (Sharpe, Sortino, Efficiency) automatically exclude traders lacking sufficient historical data points to ensure statistical validity.
            </p>
          </Section>

          <Section id="decisions" eyebrow="Reference" title="Architectural Tradeoffs">
            <p>This section documents key architectural decisions and their corresponding technical tradeoffs.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Direct API Integration:</strong> We deprecated third-party aggregators in favor of direct integration with official APIs. While this required developing a custom equity curve reconstruction engine, it ensures complete data provenance and mathematical transparency.
              </li>
              <li>
                <strong>Kalshi API Reverse-Engineering:</strong> Kalshi lacks an official public leaderboard API. The ingestion pipeline reverse-engineers the network calls utilized by Kalshi&apos;s own social leaderboard (<Code>/v1/social/leaderboard</Code>). If the endpoint structure changes, the ingestion gracefully degrades to an empty state rather than serving fabricated data.
              </li>
              <li>
                <strong>Stateless Scheduling:</strong> The backend leverages an external HTTP chron job for scheduling rather than internal cron processes. This accommodates the constraints of a serverless/scaled-to-zero hosting environment.
              </li>
              <li>
                <strong>Capital Efficiency Proxies:</strong> The &quot;Deposits&quot; metric (the denominator for capital efficiency) is derived from the peak trade cost basis observed in on-chain activity, rather than audited wallet deposit history. It serves as a functional proxy for ranking purposes.
              </li>
            </ul>
          </Section>

          <Section id="stack" eyebrow="Reference" title="Technology Stack">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Frontend:</strong> Next.js (App Router) + React, deployed on Vercel. Interfaces exclusively with the internal <Code>/api/leaderboard</Code> route.
              </li>
              <li>
                <strong>Backend:</strong> Fastify (Node.js/TypeScript), deployed on Render as a background service. Handles Polymarket/Kalshi ingestion, equity curve reconstruction, and snapshot generation.
              </li>
              <li>
                <strong>Database:</strong> PostgreSQL, structured with decoupled tables for raw venue snapshots, normalized trader states, and historical rank tracking.
              </li>
            </ul>
          </Section>
        </main>
      </div>

      <footer className="mt-auto border-t border-border-soft px-4 py-6 text-center text-xs text-text-faint sm:px-6">
        Built to rank trading skill, not bankroll size.
      </footer>
    </div>
  );
}
