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
            <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-text">How Elcara Predictor works</h1>
            <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-text-muted">
              A from-scratch explanation of the architecture, data sources, and scoring methodology — written to be
              read start to finish or jumped into from the sidebar.
            </p>
          </div>

          <Section id="like-im-2" eyebrow="Overview" title="Explain it like I'm 2">
            <p>
              Imagine a leaderboard at a video arcade, except instead of &quot;highest score,&quot; it ranks people by
              <em> who plays the smartest</em> — not just who has the most coins.
            </p>
            <p>
              Two prediction markets — <strong>Polymarket</strong> and <strong>Kalshi</strong> — let people bet real
              money on real-world questions (&quot;will X happen by Y date?&quot;). Both keep a public list of their
              best traders. This site pulls that list, does its own math on top of it, and shows you who&apos;s
              actually good — not just who got lucky once with a huge bet.
            </p>
            <p>
              A trader who turned $10 into $10,010 is more impressive than one who turned $1,000,000 into
              $1,010,000 — even though the second number is bigger. That&apos;s the whole point of this site.
            </p>
          </Section>

          <Section id="big-picture" eyebrow="Overview" title="The big picture">
            <p>
              There are three moving parts: <strong>your browser</strong>, <strong>our frontend</strong> (the page
              you&apos;re looking at), and <strong>our backend</strong> (a separate always-on service). The backend
              is the only thing that ever talks to Polymarket or Kalshi directly — your browser and the frontend
              never do.
            </p>
            <DiagramCard>
              <SystemDiagram />
            </DiagramCard>
            <p>That separation exists for a concrete reason, not just tidiness — see the next section.</p>
          </Section>

          <Section id="why-backend" eyebrow="Architecture" title="Why a separate backend?">
            <p>
              The first version of this idea called Polymarket/Kalshi <em>straight from the browser</em>. That
              breaks in two ways:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Some networks quietly lie about where these sites live.</strong> On some ISPs, asking
                &quot;what&apos;s the address for Polymarket/Kalshi&apos;s API?&quot; comes back with a wrong
                address — a dead end that just times out — instead of the real one. This is DNS poisoning, not a
                firewall dropping your request; it&apos;s the equivalent of a phone book with the wrong number
                printed in it. A browser often gets the real address anyway (many browsers resolve DNS securely
                themselves rather than trusting whatever the ISP hands back), which is why it can look fine there
                while a plain server-side request gets nowhere.
              </li>
              <li>
                <strong>Even with the real address, it&apos;s occasionally flaky.</strong> These APIs sit behind
                Cloudflare/CloudFront, and a request every so often gets reset for no confirmed reason — not
                consistently, just sometimes. Retrying (already built in) rides this out reliably in practice.
              </li>
            </ul>
            <p>
              The fix has two parts: the backend looks up the real address itself through a trustworthy
              DNS-over-HTTPS resolver instead of trusting whatever the local network hands back, and it retries
              through the occasional reset. One dedicated backend server does <em>all</em> the fetching and saves
              what it finds into its own database. The frontend you&apos;re looking at only ever asks{" "}
              <em>our own</em> database for data — never Polymarket or Kalshi directly. So it doesn&apos;t matter
              where you are; if our backend can reach the source, everyone everywhere sees the data.
            </p>
            <Callout>
              If a venue is temporarily unreachable, the backend just keeps serving the last good snapshot it
              saved, marked as &quot;stale,&quot; instead of showing an error or blank page.
            </Callout>
          </Section>

          <Section id="score" eyebrow="Architecture" title="How the efficiency score is built">
            <p>
              Raw profit (P&amp;L) rewards big bankrolls, not skill. So instead of just showing P&amp;L, we rebuild
              each trader&apos;s <em>day-by-day</em> trading history and run real risk-adjusted math on it — the
              same kind hedge funds use (Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor),
              combined into one 0–100 score and a tier (Elite → Risky).
            </p>
            <DiagramCard>
              <ScoringDiagram />
            </DiagramCard>
            <p>
              Kalshi and Polymarket only hand us a headline P&amp;L number — not a day-by-day history. So we
              reconstruct that history ourselves from each trader&apos;s public on-chain activity (every trade,
              resolution payout, and reward), then re-derive the metrics from scratch.
            </p>
          </Section>

          <Section id="freshness" eyebrow="Architecture" title="Staying fresh, staying up">
            <p>
              The backend refreshes its data every few minutes on a free-tier server, which introduces its own
              quirk: free servers fall asleep when nobody&apos;s hit them in a while — and a sleeping server
              can&apos;t run its own alarm clock to wake itself up and refresh the data.
            </p>
            <DiagramCard>
              <FreshnessDiagram />
            </DiagramCard>
            <p>
              So an outside service pokes the backend on a schedule: one poke just says &quot;stay awake,&quot;
              another says &quot;go refresh the data now.&quot; That&apos;s the actual scheduler — not anything
              running inside the backend itself.
            </p>
          </Section>

          <Section id="filters" eyebrow="Using the leaderboard" title="Filters & the confidence flag">
            <p>
              <strong>Profitable only</strong> (on by default) hides anyone whose all-time P&amp;L isn&apos;t
              positive — you can turn it off to see the full field, losers included.
            </p>
            <p>
              <strong>Low confidence</strong> traders are ones where our reconstructed day-by-day P&amp;L
              doesn&apos;t closely match the venue&apos;s own official total — meaning our derived risk metrics for
              that trader might be off, so we flag it rather than silently present a possibly-wrong score. You can
              hide these with a toggle.
            </p>
            <p>
              Most of these aren&apos;t really a mismatch, though — they&apos;re a confirmed platform limit.
              Polymarket&apos;s public activity API hard-rejects any request past 5,000 events per wallet
              (<Code>&quot;max historical activity offset of 5000 exceeded&quot;</Code>). For a highly active,
              long-tenured trader, 5,000 events can cover as little as a few weeks — nowhere near their full
              lifetime record, which the venue&apos;s own leaderboard total still reflects. That case gets a
              distinct, calmer <em>info</em> icon rather than the orange warning, since it&apos;s an explainable
              upstream ceiling, not something wrong with our math. The orange warning is reserved for the rarer
              case where history was retrievable but still doesn&apos;t add up.
            </p>
            <p>
              Ratio-based sorts (Sharpe, Sortino, Efficiency, etc.) also hide anyone with too little trading history
              to trust a ratio from — a trader with 2 trades can&apos;t have a meaningful Sharpe ratio, however it
              happens to compute.
            </p>
          </Section>

          <Section id="decisions" eyebrow="Reference" title="Decisions & tradeoffs">
            <p>This section is the honest version — what we chose, and what we gave up to get it.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>We dropped a third-party aggregator we used early on</strong> in favor of hitting
                Polymarket&apos;s own official API directly. It meant more engineering (rebuilding the day-by-day
                history and metrics ourselves), but it means the P&amp;L and rankings shown are traceable to the
                venue&apos;s own numbers, not someone else&apos;s black-box recomputation.
              </li>
              <li>
                <strong>Kalshi has no official public leaderboard API</strong> — its documented API is
                key-authenticated and only exposes your <em>own</em> account, not other traders&apos; rankings.
                Instead we reverse-engineered the calls its own social leaderboard page makes
                (<Code>/v1/social/leaderboard</Code>, <Code>/profile</Code>, <Code>/metrics</Code>) directly from
                browser traffic. The ranking metric currently defaults to <Code>projected_pnl</Code> over a
                confirmed-working <Code>weekly</Code> window — the closest real option to &quot;profit,&quot;
                though not literally all-time PnL, since an all-time equivalent hasn&apos;t been confirmed yet. If
                the endpoint ever breaks or changes shape, ingestion degrades to an empty, clearly-labeled slice
                rather than guessing at fabricated data.
              </li>
              <li>
                <strong>Neither venue has a dedicated &quot;X/Twitter handle&quot; field</strong> — traders link
                their account by pasting an x.com URL into a freeform bio field instead (Kalshi&apos;s{" "}
                <Code>social_profile.description</Code>, Polymarket&apos;s <Code>bio</Code> on activity records). We
                extract the handle from that URL rather than a structured field, so coverage is inherently partial:
                only traders who&apos;ve actually done this show an X link.
              </li>
              <li>
                <strong>The backend runs on a free always-on tier</strong>, which sleeps when idle. Rather than
                pretend an internal cron job would keep it alive (it wouldn&apos;t — a sleeping process runs
                nothing), an external pinger is the explicit, documented scheduler. This is a real constraint of
                running for free, stated plainly rather than hidden.
              </li>
              <li>
                <strong>&quot;Deposits&quot; (the capital-efficiency denominator) is a proxy</strong> — peak trade
                cost basis from on-chain activity, not verified wallet deposit history. It&apos;s good enough to
                rank by, but it&apos;s not audited on-chain deposit data; traders where it can&apos;t be resolved
                are excluded from that specific sort rather than shown a fake ratio.
              </li>
            </ul>
          </Section>

          <Section id="stack" eyebrow="Reference" title="Tech stack, briefly">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Frontend:</strong> Next.js (App Router) + React, deployed on Vercel. Reads only from our own
                backend&apos;s <Code>/api/leaderboard</Code>.
              </li>
              <li>
                <strong>Backend:</strong> Fastify (Node/TypeScript), deployed on Render as an always-on service in a
                US region. Ingests Polymarket + Kalshi, reconstructs equity curves, computes scores, writes
                snapshots.
              </li>
              <li>
                <strong>Storage:</strong> Postgres — one table of raw per-venue snapshots, one table of current
                per-trader state, one table of rank history over time (so the UI can show &quot;up 3 spots since
                last refresh&quot;).
              </li>
              <li>
                <strong>No demo data, ever.</strong> If live data can&apos;t be fetched and there&apos;s no prior
                good snapshot, the page shows an honest error — never fabricated numbers.
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
