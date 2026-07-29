import bcrypt from "bcryptjs";

// Split out from lib/auth.ts (no next/headers import) so prisma/seed.ts —
// which runs as a plain Node script outside the Next.js server — can hash
// passwords without pulling in Next-only APIs.

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
