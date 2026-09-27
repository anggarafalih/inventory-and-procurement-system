import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/generated/prisma";

/// Pure JWT encode/decode for the session cookie. No `next/headers` and no
/// `server-only` here so this module is safe to import from `proxy.ts` (which
/// runs outside the React server context) as well as the DAL.

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 16) {
  throw new Error(
    "SESSION_SECRET is missing or too short. Set it in .env (see .env.example).",
  );
}
const encodedKey = new TextEncoder().encode(secret);

export const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? "7") || 7;

export interface SessionPayload {
  userId: string;
  role: Role;
  [key: string]: unknown;
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(encodedKey);
}

export async function decryptSession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "session";
