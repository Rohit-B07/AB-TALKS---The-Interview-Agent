"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";

const DEFAULT_PHASES = ["Analyzing your answer...", "Selecting the next topic..."];

interface ThinkingIndicatorProps {
  phases?: string[];
}

export function ThinkingIndicator({ phases = DEFAULT_PHASES }: ThinkingIndicatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % phases.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [phases]);

  return (
    <div
      role="status"
      aria-label={phases[index]}
      className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-4"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-5 animate-pulse text-primary" />
      </div>
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">{phases[index]}</p>
        <p className="animate-in fade-in text-muted-foreground [animation-delay:700ms] [animation-fill-mode:both]">
          The interviewer adapts to your answer.
        </p>
      </div>
    </div>
  );
}
