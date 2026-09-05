/**
 * Integração Google Sheets — sem dependências externas.
 * Usa Web Crypto API (RSA-SHA256) e fetch nativo para autenticar via Service Account.
 * Compatível com Cloudflare Workers, Next.js Edge Runtime e Node.js.
 *
 * Variáveis necessárias:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — JSON minificado da chave do service account
 *   GOOGLE_SHEET_ID              — ID da planilha (trecho da URL entre /d/ e /edit)
 *   GOOGLE_SHEET_NAME            — Nome da aba (default: "Pedidos")
 *
 * Colunas da planilha (crie manualmente a linha 1 com os cabeçalhos):
 *   A: Código | B: Nome | C: Itens | D: Total
 *   E: Status Pagamento | F: Status Pedido | G: Criado em | H: Pago em
 *
 * Compartilhe a planilha com o e-mail do service account como Editor.
 * Todos os erros são capturados e logados — nunca interrompem o fluxo principal.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface Config {
  sa: ServiceAccount;
  sheetId: string;
  sheetName: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let tokenCache: { value: string; expiresAt: number } | null = null;

function getConfig(): Config | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!raw || !sheetId) return null;
  try {
    return {
      sa: JSON.parse(raw) as ServiceAccount,
      sheetId,
      sheetName: process.env.GOOGLE_SHEET_NAME ?? "Pedidos",
    };
  } catch {
    console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON inválido");
    return null;
  }
}

// ── Web Crypto helpers ─────────────────────────────────────────────────────

/** Codifica ArrayBuffer ou Uint8Array em base64url (sem padding). */
function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Codifica uma string UTF-8 em base64url. */
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str));
}

/** Converte chave privada PEM (PKCS#8) em ArrayBuffer DER. */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

/** Gera um JWT RS256 assinado com a chave privada do Service Account. */
async function makeJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64urlStr(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${b64url(signature)}`;
}

async function getToken(sa: ServiceAccount): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await makeJwt(sa),
    }),
  });
  if (!res.ok) throw new Error(`OAuth: ${await res.text()}`);
  const d = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { value: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function api(cfg: Config, path: string, method: string, body?: unknown): Promise<Response> {
  const token = await getToken(cfg.sa);
  return fetch(`${BASE}/${cfg.sheetId}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Labels em PT-BR ────────────────────────────────────────────────────────

const P_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
};
const O_LABEL: Record<string, string> = {
  CREATED: "Criado",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function labelP(s: string): string {
  return P_LABEL[s] ?? s;
}
function labelO(s: string): string {
  return O_LABEL[s] ?? s;
}
function fmtDate(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  // O prefixo ' força o Sheets a tratar a célula como texto (USER_ENTERED),
  // evitando a conversão automática para serial de data.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const brt = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `'${pad(brt.getDate())}/${pad(brt.getMonth() + 1)}/${brt.getFullYear()} ${pad(brt.getHours())}:${pad(brt.getMinutes())}`;
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export type SheetOrderData = {
  publicId: string;
  customerName: string;
  itemsSummary: string; // ex: "2x Coxinha, 1x Brigadeiro"
  total: string; // ex: "R$ 13,50"
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  paidAt?: string | null;
};

// ── Operações públicas ─────────────────────────────────────────────────────

/** Adiciona uma nova linha ao fim da planilha. Silencioso em caso de erro. */
export async function appendOrderRow(order: SheetOrderData): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  try {
    const range = encodeURIComponent(`${cfg.sheetName}!A:H`);
    const res = await api(
      cfg,
      `values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      "POST",
      {
        values: [
          [
            order.publicId,
            order.customerName,
            order.itemsSummary,
            order.total,
            labelP(order.paymentStatus),
            labelO(order.orderStatus),
            fmtDate(order.createdAt),
            fmtDate(order.paidAt),
          ],
        ],
      },
    );
    if (!res.ok) console.error("[sheets] append:", await res.text());
  } catch (err) {
    console.error("[sheets] append exception:", err);
  }
}

/** Atualiza os campos de status de um pedido existente pelo Código. */
export async function updateOrderRow(
  publicId: string,
  updates: { paymentStatus: string; orderStatus: string; paidAt?: string | null },
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  try {
    // Encontra a linha pelo public_id na coluna A
    const colA = encodeURIComponent(`${cfg.sheetName}!A:A`);
    const getRes = await api(cfg, `values/${colA}`, "GET");
    if (!getRes.ok) {
      console.error("[sheets] get colA:", await getRes.text());
      return;
    }
    const { values } = (await getRes.json()) as { values?: string[][] };
    const rowIdx = values?.findIndex((r) => r[0] === publicId) ?? -1;
    if (rowIdx === -1) {
      console.warn(`[sheets] public_id não encontrado: ${publicId}`);
      return;
    }
    const row = rowIdx + 1;

    // Atualiza F:G (status pagamento e status pedido)
    const rangeStatus = encodeURIComponent(`${cfg.sheetName}!F${row}:G${row}`);
    const r1 = await api(cfg, `values/${rangeStatus}?valueInputOption=USER_ENTERED`, "PUT", {
      values: [[labelP(updates.paymentStatus), labelO(updates.orderStatus)]],
    });
    if (!r1.ok) console.error("[sheets] update status:", await r1.text());

    // Atualiza I (pago em) se tiver valor
    if (updates.paidAt) {
      const rangePaidAt = encodeURIComponent(`${cfg.sheetName}!I${row}`);
      const r2 = await api(cfg, `values/${rangePaidAt}?valueInputOption=USER_ENTERED`, "PUT", {
        values: [[fmtDate(updates.paidAt)]],
      });
      if (!r2.ok) console.error("[sheets] update paidAt:", await r2.text());
    }
  } catch (err) {
    console.error("[sheets] update exception:", err);
  }
}
