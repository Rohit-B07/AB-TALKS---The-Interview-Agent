import Link from "next/link";
import { FinalReport } from "@/components/report/final-report";
import { SessionExpired } from "@/components/interview/session-expired";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { interviewService } from "@/server/services/interview.service";

interface ReportPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { sessionId } = await params;

  let session;
  try {
    session = await interviewService.getSession(sessionId);
  } catch {
    return <SessionExpired />;
  }

  if (session.status !== "completed") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Report not ready yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <p className="text-sm text-muted-foreground">
              Your final evaluation is generated after the interview is complete.
              Keep answering questions and your report will appear here.
            </p>
            <Link href={`/interview?sessionId=${sessionId}`} className={buttonVariants({})}>
              Back to interview
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const evaluation = await interviewService.getFinalEvaluation(sessionId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to candidates
      </Link>
      <FinalReport candidate={session.candidate} mode={session.mode} evaluation={evaluation} />
    </main>
  );
}
