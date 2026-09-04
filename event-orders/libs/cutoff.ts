/**
 * Controle de prazo para pedidos antecipados.
 *
 * Variável de ambiente: EVENT_CUTOFF (ISO 8601 com timezone)
 * Exemplo: EVENT_CUTOFF=2026-09-23T23:59:00-03:00
 *
 * Janela de aviso: 48 horas antes do corte.
 */

const WARNING_HOURS = 48;

/** Retorna a data/hora de corte configurada. Lança se não definida ou inválida. */
export function getCutoffDate(): Date {
  const raw = process.env.EVENT_CUTOFF;
  if (!raw) throw new Error("EVENT_CUTOFF não configurado.");
  const date = new Date(raw);
  if (isNaN(date.getTime()))
    throw new Error(
      `EVENT_CUTOFF inválido: "${raw}". Use ISO 8601 com fuso, ex.: 2026-09-23T23:59:00-03:00`,
    );
  return date;
}

/** O prazo já passou? (pedidos devem ser bloqueados) */
export function isCutoffPassed(now: Date = new Date()): boolean {
  try {
    return now >= getCutoffDate();
  } catch {
    return false; // sem configuração → não bloqueia
  }
}

/** Estamos dentro da janela de aviso (48h antes do corte)? */
export function isWithinWarningWindow(now: Date = new Date()): boolean {
  try {
    const cutoff = getCutoffDate();
    const warningStart = new Date(cutoff.getTime() - WARNING_HOURS * 60 * 60 * 1000);
    return now >= warningStart && now < cutoff;
  } catch {
    return false;
  }
}

/** Tempo restante até o corte (retorna zeros se já passou). */
export function timeUntilCutoff(now: Date = new Date()): { hours: number; minutes: number } {
  try {
    const diff = Math.max(0, getCutoffDate().getTime() - now.getTime());
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    };
  } catch {
    return { hours: 0, minutes: 0 };
  }
}
