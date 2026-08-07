import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { InterviewQuestion } from "@/server/types";

interface QuestionPanelProps {
  question: InterviewQuestion;
  questionNumber: number;
  answered: boolean;
}

export function QuestionPanel({ question, questionNumber, answered }: QuestionPanelProps) {
  return (
    <Card className={answered ? "ring-1 ring-emerald-500/40" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Question {questionNumber}</CardTitle>
          <Badge variant="secondary">{question.difficulty}</Badge>
          <Badge variant="outline">{question.type}</Badge>
          {answered ? (
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600">
              <CircleCheck className="size-3" />
              answered
            </Badge>
          ) : null}
        </div>
        <CardDescription>{question.context}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-base leading-relaxed">{question.prompt}</p>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Based on curriculum: {question.relatedDayIds.join(", ")}
        </p>
      </CardContent>
    </Card>
  );
}
