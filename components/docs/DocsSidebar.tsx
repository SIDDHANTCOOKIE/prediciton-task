"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { DOCS_NAV } from "./docsNav";

export function DocsSidebar() {
  const [activeId, setActiveId] = useState<string>(DOCS_NAV[0].items[0].id);

  useEffect(() => {
    const ids = DOCS_NAV.flatMap((g) => g.items.map((i) => i.id));
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport among those currently intersecting —
        // gives a stable "which section am I reading" signal as you scroll, rather than jumping
        // around when multiple short sections are visible at once.
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-6 hidden max-h-[calc(100vh-3rem)] w-[210px] shrink-0 overflow-y-auto pb-10 lg:block">
      <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">Documentation</div>
      {DOCS_NAV.map((group) => (
        <div key={group.label} className="mb-5">
          <div className="mb-1.5 px-2 text-[11px] font-semibold text-text-faint">{group.label}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={clsx(
                    "block rounded-md px-2 py-1.5 text-[13px] leading-tight transition-colors",
                    activeId === item.id ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-row-hover hover:text-text"
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
