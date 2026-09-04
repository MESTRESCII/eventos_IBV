/**
 * Gerenciamento de sessão do painel admin.
 * Usa apenas Web Platform APIs (crypto.subtle, TextEncoder) —
 * funciona em Node.js 18+ e no edge runtime do Next.js.
 */

const ALGO = { name: "HMAC", hash: "SHA-256" } as const;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
export const COOKIE_NAME = "__ibv_session";

function b64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "==".slice((2 - (b64.length & 3)) & 3);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), ALGO, false, [
    "sign",
    "verify",
  ]);
}

/** Cria token de sessão assinado via HMAC-SHA256 com validade de 7 dias. */
export async function createSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET não configurado.");
  const payload = `admin|${Date.now() + SESSION_DURATION_MS}`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(ALGO, key, new TextEncoder().encode(payload));
  return `${b64urlEncode(new TextEncoder().encode(payload))}.${b64urlEncode(sig)}`;
}

/** Retorna true se o token é válido e não expirou. Nunca lança exceção. */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) return false;
    const dot = token.indexOf(".");
    if (dot === -1) return false;
    const payloadBytes = b64urlDecode(token.slice(0, dot));
    const sigBytes = b64urlDecode(token.slice(dot + 1));
    const payload = new TextDecoder().decode(payloadBytes);
    const [role, expiryStr] = payload.split("|");
    if (role !== "admin") return false;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;
    const key = await importKey(secret);
    return await crypto.subtle.verify(ALGO, key, sigBytes, payloadBytes);
  } catch {
    return false;
  }
}
