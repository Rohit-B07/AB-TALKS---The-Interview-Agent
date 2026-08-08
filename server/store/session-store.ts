import { Redis } from "@upstash/redis";
import { AppError } from "@/server/errors/app-error";
import type { InterviewSession } from "@/server/types";
import { RedisSessionStore } from "./redis-session-store";

/**
 * Storage contract for interview sessions.
 *
 * The interface is deliberately tiny so swapping the in-memory implementation
 * for a database (e.g. Redis, Postgres, Mongo) is a drop-in change.
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

/** Reads a positive integer env var, falling back to a default. */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_SESSION_KEY_PREFIX = "abtalks:session";

/**
 * Picks the session store from the environment.
 *
 * - `SESSION_STORE=memory` forces the in-memory store.
 * - `SESSION_STORE=redis` requires Redis credentials or throws.
 * - Unset: uses Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN` (or the Vercel KV
 *   equivalents `KV_REST_API_URL`/`KV_REST_API_TOKEN`) are present, otherwise
 *   falls back to in-memory so local/CI runs work out of the box.
 */
export function createSessionStore(): SessionStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  const mode = process.env.SESSION_STORE?.trim().toLowerCase();
  if (mode === "memory") {
    return new InMemorySessionStore();
  }
  if (mode === "redis" || (mode === undefined && url && token)) {
    if (!url || !token) {
      throw new AppError(
        "SESSION_STORE_MISCONFIGURED",
        'SESSION_STORE=redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).'
      );
    }
    return new RedisSessionStore(new Redis({ url, token }), {
      keyPrefix: process.env.SESSION_KEY_PREFIX?.trim() || DEFAULT_SESSION_KEY_PREFIX,
      ttlSeconds: parsePositiveInt(process.env.SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS),
    });
  }
  return new InMemorySessionStore();
}

// Keep a single store instance across module reloads during development
// (Next.js hot reload would otherwise reset in-memory sessions).
const globalForStore = globalThis as unknown as {
  __abtalksSessionStore?: SessionStore;
};

export const sessionStore: SessionStore =
  globalForStore.__abtalksSessionStore ?? (globalForStore.__abtalksSessionStore = createSessionStore());
