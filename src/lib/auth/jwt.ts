import { SignJWT, jwtVerify } from "jose";

// Edge-safe: imported by middleware. No next/headers here.

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  sub: string; // user id
  name: string; // display name
  admin: boolean;
  // present after an admin reset; the proxy pins the user to /cuenta until cleared
  mustChangePassword?: boolean;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    name: payload.name,
    admin: payload.admin,
    ...(payload.mustChangePassword ? { mustChangePassword: true } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      admin: payload.admin === true,
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
