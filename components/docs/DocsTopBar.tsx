"use client";

import dynamic from "next/dynamic";
import { NavTabs } from "@/components/Header";
import { Logo } from "@/components/Logo";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), {
  ssr: false,
  loading: () => <div className="h-8 w-8 shrink-0" />,
});

export function DocsTopBar() {
  return (
    <header className="border-b border-border-soft px-4 pb-5 pt-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Logo size={30} withWordmark={false} />
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text sm:text-[28px]">How this works</h1>
          <p className="mt-1 text-sm text-text-muted">The product, explained from scratch — no prior context assumed.</p>
        </div>
        <div className="flex items-center gap-3">
          <NavTabs />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
