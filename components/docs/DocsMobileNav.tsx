import { DOCS_NAV } from "./docsNav";

/** Sidebar (components/docs/DocsSidebar.tsx) is desktop-only (lg:block) — this is the mobile/
 *  tablet fallback so section navigation isn't lost below that breakpoint, just presented as a
 *  horizontally-scrollable pill row instead of a fixed sidebar. */
export function DocsMobileNav() {
  return (
    <nav className="-mx-4 flex gap-1.5 overflow-x-auto border-b border-border-soft px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
      {DOCS_NAV.flatMap((g) => g.items).map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-text-faint hover:text-text"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
