"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

export function Dropdown({
  trigger,
  children,
  align = "left",
  panelClassName,
}: {
  trigger: (opts: { open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger({ open })}</div>
      {open && (
        <div
          className={clsx(
            "animate-fade-in-up absolute top-[calc(100%+6px)] z-30 min-w-[220px] rounded-xl border border-border bg-bg-elevated shadow-2xl",
            align === "left" ? "left-0" : "right-0",
            panelClassName
          )}
          style={{ boxShadow: "0 12px 32px -8px hsl(var(--shadow-color) / 0.35)" }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
