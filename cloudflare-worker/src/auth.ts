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
const PBKDF2_ITERATIONS = 100_000;

function base64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256));
}

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

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64(salt)}$${base64(digest)}`;
}

export async function verifyPassword(plain: string, passwordHash: string) {
  if (!passwordHash.startsWith("pbkdf2$")) return compare(plain, passwordHash);
  const [, rawIterations, encodedSalt, encodedDigest] = passwordHash.split("$");
  const iterations = Number(rawIterations);
  if (!Number.isInteger(iterations) || iterations < 50_000 || iterations > 500_000 || !encodedSalt || !encodedDigest) return false;
  const expected = fromBase64(encodedDigest), actual = await derivePassword(plain, fromBase64(encodedSalt), iterations);
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index];
  return difference === 0;
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function cookieToken(request: Request) {
  const value = request.headers.get("cookie") || "";
  return value.split(";").map(v => v.trim()).find(v => v.startsWith("access_token="))?.slice("access_token=".length);
}
