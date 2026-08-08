import { AppError } from "@/server/errors/app-error";
import type { InterviewSession } from "@/server/types";
import type { SessionStore } from "./session-store";

/**
 * Minimal subset of the @upstash/redis client surface that the store needs.
 *
 * Declaring this instead of depending on the concrete `Redis` type keeps the
 * store trivially testable (a tiny fake implements it) while remaining
 * structurally compatible with the real client.
 */
export interface KvLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set<TData = unknown>(
    key: string,
    value: TData,
    opts?: { ex?: number; xx?: boolean }
  ): Promise<unknown>;
}

export interface RedisSessionStoreOptions {
  /** Key namespace prefix, e.g. "abtalks:session". */
  keyPrefix: string;
  /** Per-key time-to-live in seconds (sliding, refreshed on update). */
  ttlSeconds: number;
}

/**
 * Redis-backed session store.
 *
 * Sessions are stored as JSON under `${keyPrefix}:${sessionId}` with a TTL so
 * stale interviews are reaped automatically. `update` only writes to an
 * existing key (SET ... XX), preserving the "reject unknown sessions" contract
 * of the SessionStore interface.
 */
export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly client: KvLike,
    private readonly options: RedisSessionStoreOptions
  ) {}

  private key(sessionId: string): string {
    return `${this.options.keyPrefix}:${sessionId}`;
  }

  async create(session: InterviewSession): Promise<InterviewSession> {
    const key = this.key(session.id);
    try {
      await this.client.set(key, session, {
        ex: this.options.ttlSeconds,
      });
      console.log(`[session-store] create ok session=${session.id} key=${key}`);
    } catch (error) {
      console.error(
        `[session-store] create FAILED session=${session.id} key=${key} error=${sanitizeError(error)}`
      );
      throw toStoreError();
    }
    return structuredClone(session);
  }

  async get(sessionId: string): Promise<InterviewSession | null> {
    const key = this.key(sessionId);
    try {
      const session = await this.client.get<InterviewSession>(key);
      console.log(
        `[session-store] get session=${sessionId} key=${key} found=${session != null}`
      );
      return session ?? null;
    } catch (error) {
      console.error(
        `[session-store] get ERROR session=${sessionId} key=${key} error=${sanitizeError(error)}`
      );
      throw toStoreError();
    }
  }

  async update(session: InterviewSession): Promise<InterviewSession> {
    const key = this.key(session.id);
    let result: unknown;
    try {
      result = await this.client.set(key, session, {
        ex: this.options.ttlSeconds,
        xx: true,
      });
    } catch (error) {
      console.error(
        `[session-store] update ERROR session=${session.id} key=${key} error=${sanitizeError(error)}`
      );
      throw toStoreError();
    }
    if (result === null) {
      console.warn(`[session-store] update MISSING session=${session.id} key=${key}`);
      throw new AppError(
        "INVALID_SESSION",
        `Interview session "${session.id}" was not found.`
      );
    }
    console.log(`[session-store] update ok session=${session.id} key=${key}`);
    return structuredClone(session);
  }
}

/**
 * One-line, safe description of a storage error.
 *
 * Never includes the raw error message: @upstash/redis errors embed the full
 * command, which contains the serialized interview session (candidate data,
 * transcript, internal memory).
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.constructor.name;
  }
  return typeof error;
}

/**
 * Maps any storage failure to a stable AppError with a generic message.
 *
 * The underlying error is intentionally not attached: it can carry the whole
 * session payload, and attaching it would leak candidate data through the API
 * error envelope and `handleApiError`'s "unexpected error" log.
 */
function toStoreError(): AppError {
  return new AppError(
    "SESSION_STORE_ERROR",
    "Session storage is temporarily unavailable. Please try again."
  );
}
