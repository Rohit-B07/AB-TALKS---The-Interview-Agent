"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CandidateCard } from "@/components/landing/candidate-card";
import { ErrorState } from "@/components/error-state";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError, describeError } from "@/lib/api";
import type { CandidateInsights } from "@/server/services/insights.service";
import type { Candidate, StartInterviewResponse } from "@/server/types";

interface CandidatePickerProps {
  candidates: Candidate[];
  insightsByCandidate: Record<string, CandidateInsights>;
}

export function CandidatePicker({ candidates, insightsByCandidate }: CandidatePickerProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedId) ?? null;

  const handleStart = async () => {
    if (!selectedId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const data = await apiFetch<StartInterviewResponse>("/api/interview/start", {
        method: "POST",
        body: JSON.stringify({ candidateId: selectedId }),
      });
      router.push(`/interview?sessionId=${data.sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err) : "Failed to start the interview.");
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-24 sm:pb-4">
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
              onSelect={(id) => {
                setSelectedId(id);
                setError(null);
              }}
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
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarInitials name={selectedCandidate.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedCandidate.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {insightsByCandidate[selectedCandidate.id]?.completedDays} of{" "}
                  {insightsByCandidate[selectedCandidate.id]?.totalDays} days completed
                </p>
              </div>
            </div>
            <Button size="lg" onClick={handleStart} disabled={starting} className="gap-2">
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Begin interview
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
