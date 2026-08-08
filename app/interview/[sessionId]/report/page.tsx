import Link from "next/link";
import { FinalReport } from "@/components/report/final-report";
import { ReportError, ReportUnavailable } from "@/components/report/report-states";
import { SessionExpired } from "@/components/interview/session-expired";
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
    return <ReportUnavailable sessionId={sessionId} />;
  }

  let evaluation;
  try {
    evaluation = await interviewService.getFinalEvaluation(sessionId);
  } catch {
    return <ReportError sessionId={sessionId} />;
  }

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
