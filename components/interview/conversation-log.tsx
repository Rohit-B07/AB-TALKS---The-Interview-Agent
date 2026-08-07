import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationTurn } from "@/server/types";

interface ConversationLogProps {
  turns: ConversationTurn[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ConversationLog({ turns }: ConversationLogProps) {
  if (turns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <MessagesSquare className="size-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No conversation yet.</p>
        <p className="text-xs text-muted-foreground/70">
          Answer the question and the discussion will appear here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {turns.map((turn) => {
        const isAssistant = turn.role === "assistant";
        return (
          <li
            key={turn.id}
            className={cn(
              "flex flex-col gap-1",
              isAssistant ? "items-start" : "items-end"
            )}
          >
            <div
              className={cn(
                "flex max-w-full flex-col gap-1 rounded-xl px-3 py-2 text-sm sm:max-w-[90%]",
                isAssistant
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <span className="text-xs opacity-70">
                {isAssistant ? "Interviewer" : "You"} · {formatTime(turn.createdAt)}
              </span>
              <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {isAssistant ? "question" : "answer"}
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
