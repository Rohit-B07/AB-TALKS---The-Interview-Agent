import { ArrowRight, BrainCircuit, ListChecks, MessageSquareText, Sparkles } from "lucide-react";
import { CandidatePicker } from "@/components/landing/candidate-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { candidateService } from "@/server/services/candidate.service";
import { cn } from "@/lib/utils";
import { insightsService } from "@/server/services/insights.service";

const FEATURES = [
  { icon: Sparkles, label: "Personalized Interview" },
  { icon: BrainCircuit, label: "Adaptive Questions" },
  { icon: MessageSquareText, label: "Instant AI Feedback" },
  { icon: ListChecks, label: "Enterprise AI Topics" },
];

export default async function Home() {
  const candidates = await candidateService.getCandidates();
  const insightsByCandidate = await insightsService.getInsightsForAll();

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <Badge className="gap-1.5">
            <Sparkles className="size-3" />
            ABTalks AI Cohort · Phase 2
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Practice adaptive AI engineering interviews based on your learning journey
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Pick a candidate profile and get a live interview that adapts to
            exactly what they have mastered — from Python foundations to
            production LLM systems.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <Badge key={label} variant="secondary" className="gap-1.5 px-3 py-1.5">
                <Icon className="size-3.5 text-primary" />
                {label}
              </Badge>
            ))}
          </div>
          <a href="#candidates" className={cn(buttonVariants({ size: "lg" }), "mt-2 gap-2")}>
            Choose Your Candidate
            <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      <section id="candidates" className="mx-auto w-full max-w-5xl flex-1 scroll-mt-20 px-4 py-10 sm:py-14">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Select a candidate
          </h2>
          <p className="text-sm text-muted-foreground">
            Each profile reflects a real learning journey. The interview adapts to it.
          </p>
        </div>
        <CandidatePicker candidates={candidates} insightsByCandidate={insightsByCandidate} />
      </section>
    </main>
  );
}
