import { AppError } from "@/server/errors/app-error";
import type { InterviewSession } from "@/server/types";

/**
 * Storage contract for interview sessions.
 *
 * The interface is deliberately tiny so swapping the in-memory implementation
 * for a database later (e.g. Redis, Postgres, Mongo) is a drop-in change.
 */
export interface SessionStore {
  create(session: InterviewSession): Promise<InterviewSession>;
  get(sessionId: string): Promise<InterviewSession | null>;
  update(session: InterviewSession): Promise<InterviewSession>;
}

/**
 * Phase 1 in-memory implementation.
 *
 * Sessions live in a Map for the lifetime of the server process. This is
 * enough to demo session persistence and makes the write path explicit for
 * Phase 2 (a real datastore).
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, InterviewSession>();

  async create(session: InterviewSession): Promise<InterviewSession> {
    this.sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }

  async get(sessionId: string): Promise<InterviewSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  async update(session: InterviewSession): Promise<InterviewSession> {
    if (!this.sessions.has(session.id)) {
      throw new AppError("INVALID_SESSION", `Interview session "${session.id}" was not found.`);
    }
    this.sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }
}

// Keep a single store instance across module reloads during development
// (Next.js hot reload would otherwise reset in-memory sessions).
const globalForStore = globalThis as unknown as {
  __abtalksSessionStore?: InMemorySessionStore;
};

export const sessionStore: SessionStore =
  globalForStore.__abtalksSessionStore ?? (globalForStore.__abtalksSessionStore = new InMemorySessionStore());
