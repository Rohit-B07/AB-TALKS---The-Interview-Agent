import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SessionExpired() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold">Session not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This interview session has expired or is no longer available. Start a
            new interview to keep practicing.
          </p>
        </div>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Start a new interview
        </Link>
      </div>
    </main>
  );
}
