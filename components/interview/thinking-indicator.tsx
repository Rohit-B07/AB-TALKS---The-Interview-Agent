import { Bot } from "lucide-react";

export function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-label="Analyzing your answer"
      className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-4"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-5 animate-pulse text-primary" />
      </div>
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium">Analyzing your answer...</p>
        <p className="animate-in fade-in text-muted-foreground [animation-delay:700ms] [animation-fill-mode:both]">
          Selecting the next topic...
        </p>
      </div>
    </div>
  );
}
