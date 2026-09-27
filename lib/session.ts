import "server-only";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  TTL_DAYS,
  decryptSession,
  encryptSession,
  type SessionPayload,
} from "@/lib/session-token";

export type { SessionPayload } from "@/lib/session-token";
export { SESSION_COOKIE_NAME } from "@/lib/session-token";

const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + TTL_MS),
    path: "/",
  });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
