import { BrainCircuit, ListChecks, Play, Sparkles, Target, Timer } from "lucide-react";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WelcomeInfo } from "@/server/services/insights.service";

interface WelcomeScreenProps {
  welcome: WelcomeInfo;
  onBegin: () => void;
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function WelcomeScreen({ welcome, onBegin }: WelcomeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <AvatarInitials name={welcome.firstName} className="size-14 text-lg" />
        <div className="flex flex-col gap-1">
          <Badge className="mx-auto gap-1.5">
            <Sparkles className="size-3" />
            Interview ready
          </Badge>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome, {welcome.firstName}!
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Your session is set up based on your journey — {welcome.completion} days
            completed. Today&apos;s interview will focus on:
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            Today&apos;s focus
          </CardTitle>
          <CardDescription>
            Topics pulled from the curriculum you have mastered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {welcome.focusTopics.map((topic) => (
              <li key={topic} className="flex items-center gap-2.5 text-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-foreground">{topic}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <InfoChip icon={Timer} label="Estimated duration" value={`${welcome.estimatedMinutes} min`} />
        <InfoChip icon={ListChecks} label="Questions" value={`${welcome.estimatedQuestions}+`} />
        <InfoChip icon={BrainCircuit} label="Adaptive" value="Follow-up enabled" />
      </div>

      <Button size="lg" className="w-full gap-2" onClick={onBegin}>
        <Play className="size-4" />
        Begin Interview
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No scoring or feedback yet — Phase 1 focuses on the interview flow.
      </p>
    </div>
  );
}
