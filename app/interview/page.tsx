import Link from "next/link";
import { redirect } from "next/navigation";
import { InterviewConsole } from "@/components/interview/interview-console";
import { SessionExpired } from "@/components/interview/session-expired";
import { insightsService } from "@/server/services/insights.service";
import { interviewService } from "@/server/services/interview.service";
import type { WelcomeInfo } from "@/server/services/insights.service";

interface InterviewPageProps {
  searchParams: Promise<{ sessionId?: string | string[] }>;
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const { sessionId } = await searchParams;

  if (typeof sessionId !== "string" || sessionId.length === 0) {
    redirect("/");
  }

  let session;
  try {
    session = await interviewService.getSession(sessionId);
  } catch {
    return <SessionExpired />;
  }

  const insights = await insightsService.getInsights(session.candidate);
  const welcome: WelcomeInfo = {
    firstName: session.candidate.name.split(" ")[0] || session.candidate.name,
    focusTopics: insights.focusTopics,
    estimatedMinutes: `${insights.estimatedMinutes.min}–${insights.estimatedMinutes.max}`,
    estimatedQuestions: insights.estimatedQuestions,
    completion: `${insights.completedDays} of ${insights.totalDays}`,
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to candidates
      </Link>
      <InterviewConsole
        sessionId={sessionId}
        welcome={welcome}
        initialState={interviewService.toState(session)}
      />
    </main>
  );
}
