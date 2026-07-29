import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { comparePassword } from "./password";
import type { Role } from "./constants";

const COOKIE_NAME = "session";
export const SESSION_COOKIE_NAME = COOKIE_NAME;
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    // Fail loud rather than silently signing sessions with a public default.
    throw new Error("SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
};

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  if (!prisma) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return null;
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return null;
  return toSessionUser(user);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUserFromToken(store.get(COOKIE_NAME)?.value);
}

// Token-in, user-out variant used by middleware, which reads the cookie via
// NextRequest.cookies rather than the next/headers cookies() API.
export async function getSessionUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!prisma || !token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") return null;
  return toSessionUser(user);
}

export function hasRole(user: SessionUser | null, roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}

function toSessionUser(user: {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
}): SessionUser {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    departmentId: user.departmentId,
  };
}
