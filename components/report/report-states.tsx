import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportUnavailable({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Report not ready yet</CardTitle>
          <CardDescription>Your report appears as soon as the interview wraps up.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            The final evaluation is generated after the interview is complete. Keep answering
            questions and your report will appear here.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/interview?sessionId=${sessionId}`} className={buttonVariants({})}>
              Back to interview
            </Link>
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to candidates
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export function ReportError({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>We could not load your report</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Something went wrong while generating your evaluation. Try again — if the problem
            persists, you can start a fresh interview.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/interview/${sessionId}/report`}
              className={buttonVariants({ variant: "outline" })}
            >
              Try again
            </Link>
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to candidates
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
