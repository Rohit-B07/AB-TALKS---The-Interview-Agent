import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  questionNumber: number;
  estimatedQuestions: number;
  progress?: number;
}

export function ProgressIndicator({
  questionNumber,
  estimatedQuestions,
  progress,
}: ProgressIndicatorProps) {
  const percent =
    progress ?? Math.min(100, Math.round((questionNumber / estimatedQuestions) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          Question {questionNumber} of {estimatedQuestions}
        </span>
        <span className="text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <Progress value={percent} aria-label="Interview progress" />
    </div>
  );
}
