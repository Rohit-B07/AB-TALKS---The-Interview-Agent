import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3 max-w-sm" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
