import { Badge } from "@/components/ui/badge";
import type { Candidate, SessionStatus } from "@/server/types";

interface SessionHeaderProps {
  candidate: Candidate;
  status: SessionStatus;
  createdAt: string;
  answered: boolean;
}

export function SessionHeader({ candidate, status, createdAt, answered }: SessionHeaderProps) {
  const started = new Date(createdAt).toLocaleString();

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {candidate.name}
        </h1>
        <p className="text-sm text-muted-foreground">Started {started}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {answered ? (
          <Badge variant="secondary">Answered</Badge>
        ) : (
          <Badge>Awaiting answer</Badge>
        )}
        <Badge variant="outline">{status}</Badge>
      </div>
    </header>
  );
}
