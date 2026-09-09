import { describe, it, expect, afterEach } from "vitest";
import { getBaseUrl } from "@/libs/env";

const ORIGINAL = process.env.BASE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BASE_URL;
  else process.env.BASE_URL = ORIGINAL;
});

describe("getBaseUrl", () => {
  it("remove a barra final — a causa da barra dupla que quebrava a rota do webhook", () => {
    process.env.BASE_URL = "https://eventos-ibv.workers.dev/";
    expect(getBaseUrl()).toBe("https://eventos-ibv.workers.dev");
    expect(`${getBaseUrl()}/api/webhooks/infinitepay/tok`).toBe(
      "https://eventos-ibv.workers.dev/api/webhooks/infinitepay/tok",
    );
  });

  it("remove múltiplas barras finais", () => {
    process.env.BASE_URL = "https://eventos-ibv.workers.dev///";
    expect(getBaseUrl()).toBe("https://eventos-ibv.workers.dev");
  });

  it("remove espaços e quebra de linha do Windows (\\r) vindos do .env", () => {
    process.env.BASE_URL = "  https://eventos-ibv.workers.dev/\r";
    expect(getBaseUrl()).toBe("https://eventos-ibv.workers.dev");
  });

  it("mantém intacta uma URL já correta", () => {
    process.env.BASE_URL = "https://eventos-ibv.workers.dev";
    expect(getBaseUrl()).toBe("https://eventos-ibv.workers.dev");
  });

  it("cai para localhost quando não configurado", () => {
    delete process.env.BASE_URL;
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });
});
