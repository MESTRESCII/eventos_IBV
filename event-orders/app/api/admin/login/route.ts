import { createSessionToken, COOKIE_NAME } from "@/libs/session";
import { checkRateLimit, resetRateLimit } from "@/libs/ratelimit";
import { timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias em segundos

export async function POST(req: Request) {
  // IP do cliente (Next.js injeta x-forwarded-for em produção)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return Response.json(
      {
        error: `Muitas tentativas. Tente novamente em ${Math.ceil((rl.retryAfterSec ?? 900) / 60)} minutos.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec ?? 900) },
      },
    );
  }

  let password: string;
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  // Comparação em tempo constante para evitar timing attack
  const inputBuf = Buffer.alloc(64, 0);
  const expectedBuf = Buffer.alloc(64, 0);
  inputBuf.write(password.slice(0, 64));
  expectedBuf.write(adminPassword.slice(0, 64));

  const match =
    adminPassword.length > 0 &&
    timingSafeEqual(inputBuf, expectedBuf) &&
    password === adminPassword;

  if (!match) {
    return Response.json({ error: "Senha incorreta." }, { status: 401 });
  }

  resetRateLimit(ip);

  const token = await createSessionToken();

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": [
          `${COOKIE_NAME}=${token}`,
          `Max-Age=${SESSION_MAX_AGE}`,
          "Path=/",
          "HttpOnly",
          "SameSite=Strict",
          process.env.NODE_ENV === "production" ? "Secure" : "",
        ]
          .filter(Boolean)
          .join("; "),
      },
    },
  );
}
