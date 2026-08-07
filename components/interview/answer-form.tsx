import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MAX_ANSWER_LENGTH = 2000;

interface AnswerFormProps {
  value: string;
  disabled: boolean;
  submitting: boolean;
  answered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function AnswerForm({
  value,
  disabled,
  submitting,
  answered,
  onChange,
  onSubmit,
}: AnswerFormProps) {
  const canSubmit = !answered && !submitting && value.trim().length > 0;
  const nearLimit = value.length >= MAX_ANSWER_LENGTH;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="answer">Your answer</Label>
        <span
          className={`text-xs tabular-nums ${
            nearLimit ? "font-medium text-destructive" : "text-muted-foreground"
          }`}
        >
          {value.length} / {MAX_ANSWER_LENGTH}
        </span>
      </div>
      <Textarea
        id="answer"
        placeholder="Write your answer here. Explain your reasoning and mention the tools you'd use..."
        rows={8}
        maxLength={MAX_ANSWER_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || answered}
        aria-describedby="answer-hint"
      />
      <p id="answer-hint" className="text-xs text-muted-foreground">
        {answered
          ? "Answer recorded. Follow-up questions arrive in Phase 2."
          : "A clear, structured answer helps the interviewer understand your thinking."}
      </p>
      <Button type="submit" size="lg" disabled={!canSubmit} className="self-start gap-2">
        {submitting ? "Submitting..." : "Submit answer"}
      </Button>
    </form>
  );
}
