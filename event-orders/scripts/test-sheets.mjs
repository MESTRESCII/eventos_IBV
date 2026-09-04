/**
 * Teste manual da integração Google Sheets.
 * Rode com: node --env-file=.env.local scripts/test-sheets.mjs
 */
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
let tokenCache = null;

function getConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!raw || !sheetId)
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SHEET_ID não configurados");
  return { sa: JSON.parse(raw), sheetId, sheetName: process.env.GOOGLE_SHEET_NAME ?? "Pedidos" };
}

function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url");
  const unsigned = `${h}.${p}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  return `${unsigned}.${sign.sign(sa.private_key, "base64url")}`;
}

async function getToken(sa) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: makeJwt(sa),
    }),
  });
  if (!res.ok) throw new Error(`OAuth falhou: ${await res.text()}`);
  const d = await res.json();
  tokenCache = { value: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function api(cfg, path, method, body) {
  const token = await getToken(cfg.sa);
  const res = await fetch(`${BASE}/${cfg.sheetId}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

const TEST_ID = `TESTE-${Date.now()}`;

async function main() {
  const cfg = getConfig();
  console.log(`\nPlanilha: ${cfg.sheetId}`);
  console.log(`Aba: ${cfg.sheetName}`);
  console.log(`SA: ${cfg.sa.client_email}\n`);

  // 1. Append
  process.stdout.write("1. appendOrderRow... ");
  const range = encodeURIComponent(`${cfg.sheetName}!A:I`);
  const r1 = await api(
    cfg,
    `values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    "POST",
    {
      values: [
        [
          TEST_ID,
          "Cliente Teste",
          "teste@ibv.com",
          "2x Coxinha, 1x Suco",
          "R$ 18,00",
          "Pendente",
          "Criado",
          new Date().toLocaleString("pt-BR"),
          "",
        ],
      ],
    },
  );
  if (!r1.ok) {
    console.error("FALHOU\n", await r1.text());
    process.exit(1);
  }
  const appendData = await r1.json();
  console.log("OK - linha:", appendData.updates?.updatedRange ?? "?");

  // 2. Update
  process.stdout.write("2. updateOrderRow... ");
  const getRes = await api(cfg, `values/${encodeURIComponent(`${cfg.sheetName}!A:A`)}`, "GET");
  const { values } = await getRes.json();
  const rowIdx = values?.findIndex((r) => r[0] === TEST_ID) ?? -1;
  if (rowIdx === -1) {
    console.error("FALHOU (linha nao encontrada)");
    process.exit(1);
  }
  const row = rowIdx + 1;
  const r2 = await api(
    cfg,
    `values/${encodeURIComponent(`${cfg.sheetName}!F${row}:G${row}`)}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [["Pago", "Pronto"]] },
  );
  const r3 = await api(
    cfg,
    `values/${encodeURIComponent(`${cfg.sheetName}!I${row}`)}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [[new Date().toLocaleString("pt-BR")]] },
  );
  if (!r2.ok || !r3.ok) {
    console.error("FALHOU");
    process.exit(1);
  }
  console.log(`OK - linha ${row} atualizada`);

  // 3. Remove linha de teste
  process.stdout.write("3. Removendo linha de teste... ");
  const metaRes = await api(cfg, "", "GET");
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s) => s.properties?.title === cfg.sheetName);
  const sheetGid = sheet?.properties?.sheetId ?? 0;
  const r4 = await api(cfg, `batchUpdate`, "POST", {
    requests: [
      {
        deleteDimension: {
          range: { sheetId: sheetGid, dimension: "ROWS", startIndex: rowIdx, endIndex: row },
        },
      },
    ],
  });
  if (!r4.ok) {
    console.warn("aviso: nao removeu automaticamente -", (await r4.text()).slice(0, 80));
  } else {
    console.log("OK - linha de teste removida");
  }

  console.log("\nIntegracao com Google Sheets funcionando!\n");
}

main().catch((err) => {
  console.error("\nErro:", err.message ?? err);
  process.exit(1);
});
