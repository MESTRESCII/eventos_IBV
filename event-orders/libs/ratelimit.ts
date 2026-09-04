/**
 * Rate limiter em memória para o endpoint de login.
 * Singleton de módulo — persiste enquanto o processo Node.js estiver rodando.
 * Máx: 10 tentativas por IP em 15 minutos.
 */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

/** Limpa o contador de um IP após login bem-sucedido. */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}
