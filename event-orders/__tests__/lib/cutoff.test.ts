import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCutoffDate,
  isCutoffPassed,
  isWithinWarningWindow,
  timeUntilCutoff,
} from "@/libs/cutoff";

const CUTOFF_ISO = "2026-09-23T23:59:00-03:00";
const CUTOFF = new Date(CUTOFF_ISO);

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── getCutoffDate ──────────────────────────────────────────────────────────

describe("getCutoffDate", () => {
  it("retorna a data correta quando EVENT_CUTOFF está configurado", () => {
    vi.stubEnv("EVENT_CUTOFF", CUTOFF_ISO);
    expect(getCutoffDate().getTime()).toBe(CUTOFF.getTime());
  });

  it("lança erro se EVENT_CUTOFF não está definido", () => {
    vi.stubEnv("EVENT_CUTOFF", "");
    expect(() => getCutoffDate()).toThrow("EVENT_CUTOFF não configurado");
  });

  it("lança erro se EVENT_CUTOFF é inválido", () => {
    vi.stubEnv("EVENT_CUTOFF", "nao-e-uma-data");
    expect(() => getCutoffDate()).toThrow("EVENT_CUTOFF inválido");
  });
});

// ─── isCutoffPassed ─────────────────────────────────────────────────────────

describe("isCutoffPassed", () => {
  beforeEach(() => vi.stubEnv("EVENT_CUTOFF", CUTOFF_ISO));

  it("retorna false um segundo antes do corte", () => {
    const umSegAntes = new Date(CUTOFF.getTime() - 1000);
    expect(isCutoffPassed(umSegAntes)).toBe(false);
  });

  it("retorna true exatamente no momento do corte", () => {
    expect(isCutoffPassed(CUTOFF)).toBe(true);
  });

  it("retorna true um segundo depois do corte", () => {
    const umSegDepois = new Date(CUTOFF.getTime() + 1000);
    expect(isCutoffPassed(umSegDepois)).toBe(true);
  });

  it("retorna false (não bloqueia) quando EVENT_CUTOFF não está configurado", () => {
    vi.stubEnv("EVENT_CUTOFF", "");
    expect(isCutoffPassed(new Date())).toBe(false);
  });
});

// ─── isWithinWarningWindow ───────────────────────────────────────────────────

describe("isWithinWarningWindow", () => {
  beforeEach(() => vi.stubEnv("EVENT_CUTOFF", CUTOFF_ISO));

  const warning48h = new Date(CUTOFF.getTime() - 48 * 60 * 60 * 1000);

  it("retorna false antes da janela de 48h", () => {
    const antes = new Date(warning48h.getTime() - 1000);
    expect(isWithinWarningWindow(antes)).toBe(false);
  });

  it("retorna true exatamente no início da janela de 48h", () => {
    expect(isWithinWarningWindow(warning48h)).toBe(true);
  });

  it("retorna true no meio da janela (24h antes)", () => {
    const meio = new Date(CUTOFF.getTime() - 24 * 60 * 60 * 1000);
    expect(isWithinWarningWindow(meio)).toBe(true);
  });

  it("retorna false no momento exato do corte (já bloqueado)", () => {
    expect(isWithinWarningWindow(CUTOFF)).toBe(false);
  });

  it("retorna false após o corte", () => {
    const depois = new Date(CUTOFF.getTime() + 60_000);
    expect(isWithinWarningWindow(depois)).toBe(false);
  });
});

// ─── timeUntilCutoff ─────────────────────────────────────────────────────────

describe("timeUntilCutoff", () => {
  beforeEach(() => vi.stubEnv("EVENT_CUTOFF", CUTOFF_ISO));

  it("retorna 48h 00min quando exatamente na janela de início", () => {
    const warning48h = new Date(CUTOFF.getTime() - 48 * 60 * 60 * 1000);
    const { hours, minutes } = timeUntilCutoff(warning48h);
    expect(hours).toBe(48);
    expect(minutes).toBe(0);
  });

  it("retorna 0h 00min quando o corte já passou", () => {
    const depois = new Date(CUTOFF.getTime() + 10_000);
    const { hours, minutes } = timeUntilCutoff(depois);
    expect(hours).toBe(0);
    expect(minutes).toBe(0);
  });

  it("retorna horas e minutos corretos para 1h30 antes do corte", () => {
    const ref = new Date(CUTOFF.getTime() - 90 * 60 * 1000);
    const { hours, minutes } = timeUntilCutoff(ref);
    expect(hours).toBe(1);
    expect(minutes).toBe(30);
  });
});
