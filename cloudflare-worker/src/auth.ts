import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";

export type Role = "student" | "professional" | "institution" | "admin";

export interface AccessClaims {
  sub: string;
  email: string;
  role: Role;
  type: "access";
}

const encoder = new TextEncoder();

function key(secret: string) {
  if (secret.length < 32) throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres.");
  return encoder.encode(secret);
}

export async function createAccessToken(claims: Omit<AccessClaims, "type">, secret: string) {
  return new SignJWT({ email: claims.email, role: claims.role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
  if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Token inválido");
  }
  if (!["student", "professional", "institution", "admin"].includes(String(payload.role))) {
    throw new Error("Token inválido");
  }
  return { sub: payload.sub, email: payload.email, role: payload.role as Role, type: "access" };
}

export const hashPassword = (password: string) => hash(password, 12);
export const verifyPassword = (plain: string, passwordHash: string) => compare(plain, passwordHash);

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function cookieToken(request: Request) {
  const value = request.headers.get("cookie") || "";
  return value.split(";").map(v => v.trim()).find(v => v.startsWith("access_token="))?.slice("access_token=".length);
}
