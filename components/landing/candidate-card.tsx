import { Check, Clock, Flame, Target } from "lucide-react";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CandidateInsights } from "@/server/services/insights.service";
import type { Candidate } from "@/server/types";

interface CandidateCardProps {
  candidate: Candidate;
  insights: CandidateInsights;
  selected: boolean;
  onSelect: (candidateId: string) => void;
}

function ReadinessRing({ score, tone }: { score: number; tone: "High" | "Moderate" | "Early" }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeClass =
    tone === "High" ? "stroke-emerald-500" : tone === "Moderate" ? "stroke-amber-500" : "stroke-muted-foreground";

  return (
    <div className="relative size-11 shrink-0" title={`Readiness ${score}/100`}>
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={cn("transition-all duration-700", strokeClass)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {score}
      </span>
    </div>
  );
}

export function CandidateCard({ candidate, insights, selected, onSelect }: CandidateCardProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(candidate.id);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${candidate.name} to start an interview`}
      onClick={() => onSelect(candidate.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-full cursor-pointer outline-none transition-all duration-200 select-none",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-primary shadow-md",
        !selected && "ring-1 ring-foreground/10"
      )}
    >
      <CardHeader className="flex-row items-center gap-3">
        <AvatarInitials name={candidate.name} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-base font-semibold">{candidate.name}</h3>
            {selected ? (
              <Badge className="gap-1 bg-primary text-primary-foreground">
                <Check className="size-3" />
                Selected
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {insights.completedDays} of {insights.totalDays} days · {insights.attempts}{" "}
            attempt{insights.attempts === 1 ? "" : "s"}
          </p>
        </div>
        <ReadinessRing score={insights.readinessScore} tone={insights.readinessLabel} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Curriculum progress</span>
            <span className="font-medium tabular-nums">{insights.completionPercent}%</span>
          </div>
          <Progress value={insights.completionPercent} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={Target} label="Readiness" value={insights.readinessLabel} />
          <Stat icon={Clock} label="Est. time" value={`${insights.estimatedMinutes.min}–${insights.estimatedMinutes.max}m`} />
          <Stat icon={Flame} label="Level" value={capitalize(insights.difficulty)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {insights.strengths.map((strength) => (
              <Badge key={strength} variant="secondary">
                {strength}
              </Badge>
            ))}
          </div>
        </div>

        {insights.focusAreas.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Focus areas
            </p>
            <p className="text-sm text-muted-foreground">{insights.focusAreas.join(" · ")}</p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
        <span>~{insights.estimatedQuestions} questions</span>
        <span className="font-medium text-primary">{selected ? "Ready to begin" : "Tap to select"}</span>
      </CardFooter>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
