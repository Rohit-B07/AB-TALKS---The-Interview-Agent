"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CandidateCard } from "@/components/landing/candidate-card";
import { ErrorState } from "@/components/error-state";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError, describeError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MODE_LABELS } from "@/prompts/mode";
import type { CandidateInsights } from "@/server/services/insights.service";
import type { Candidate, InterviewMode, StartInterviewResponse } from "@/server/types";

const MODE_OPTIONS: { value: InterviewMode; label: string }[] = [
  { value: "dsa_friendly", label: MODE_LABELS.dsa_friendly },
  { value: "ai_engineering", label: MODE_LABELS.ai_engineering },
];

const BEGIN_LABELS: Record<InterviewMode, string> = {
  dsa_friendly: "Begin DSA Interview",
  ai_engineering: "Begin AI Interview",
};

interface CandidatePickerProps {
  candidates: Candidate[];
  insightsByCandidate: Record<string, CandidateInsights>;
}

function ModeToggle({
  value,
  onChange,
}: {
  value: InterviewMode;
  onChange: (mode: InterviewMode) => void;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const length = MODE_OPTIONS.length;
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + length) % length;
    const nextValue = MODE_OPTIONS[nextIndex].value;
    onChange(nextValue);
    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Interview mode"
      className="flex w-fit items-center gap-1 rounded-full border bg-muted/50 p-1"
    >
      {MODE_OPTIONS.map((option, index) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function CandidatePicker({ candidates, insightsByCandidate }: CandidatePickerProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<InterviewMode>("ai_engineering");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedId) ?? null;
  const selectedInsights = selectedCandidate
    ? insightsByCandidate[selectedCandidate.id]
    : undefined;

  const handleSelectCandidate = (id: string) => {
    const chosen = candidates.find((candidate) => candidate.id === id);
    setSelectedId(id);
    if (chosen) setMode(chosen.defaultMode);
    setError(null);
  };

  const handleStart = async () => {
    if (!selectedId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const data = await apiFetch<StartInterviewResponse>("/api/interview/start", {
        method: "POST",
        body: JSON.stringify({ candidateId: selectedId, mode }),
      });
      router.push(`/interview?sessionId=${data.sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err) : "Failed to start the interview.");
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-48 lg:pb-24">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((candidate) => {
          const insights = insightsByCandidate[candidate.id];
          if (!insights) return null;
          return (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              insights={insights}
              selected={selectedId === candidate.id}
              onSelect={handleSelectCandidate}
            />
          );
        })}
      </div>

      {error ? (
        <ErrorState title="Could not start interview" message={error} onRetry={handleStart} />
      ) : null}

      {!selectedCandidate ? (
        <p className="text-center text-sm text-muted-foreground">
          No candidate selected yet. Tap a profile to begin.
        </p>
      ) : null}

      {selectedCandidate ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarInitials name={selectedCandidate.name} className="size-10 text-sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{selectedCandidate.name}</p>
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Check className="size-3" />
                    Selected
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedInsights
                    ? `${selectedInsights.completedDays} of ${selectedInsights.totalDays} days · ${selectedInsights.completionPercent}% complete`
                    : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Interview mode
              </span>
              <ModeToggle value={mode} onChange={setMode} />
            </div>

            <Button
              size="lg"
              onClick={handleStart}
              disabled={starting}
              className="w-full justify-center gap-2 lg:w-auto"
            >
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {BEGIN_LABELS[mode]}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
