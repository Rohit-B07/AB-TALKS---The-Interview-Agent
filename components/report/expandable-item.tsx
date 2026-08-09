"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableItemProps {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Lightweight, accessible expand/collapse card. Uses aria-expanded /
 * aria-controls and a smooth CSS grid animation, no extra dependencies.
 */
export function ExpandableItem({
  id,
  title,
  meta,
  icon,
  defaultOpen = false,
  className,
  children,
}: ExpandableItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const triggerId = `${id}-trigger`;
  const contentId = `${id}-content`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        open ? "ring-1 ring-foreground/10" : "hover:bg-muted/40",
        className
      )}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="flex-1 text-sm font-medium">{title}</span>
        {meta ? <span className="shrink-0">{meta}</span> : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
