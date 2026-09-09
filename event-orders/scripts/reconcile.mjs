#!/usr/bin/env node
/**
 * CLI de reconciliação de pagamentos InfinitePay.
 *
 * Não reimplementa nenhuma regra: chama os próprios endpoints da aplicação, de modo que
 * o que é testado aqui é exatamente o caminho de produção.
 *
 * Uso:
 *   npm run reconcile -- --order 18C50 --nsu <transaction_nsu> [--slug <invoice_slug>]
 *   npm run reconcile -- --all
 *   npm run reconcile -- --raw --order 18C50 --nsu <transaction_nsu> [--slug <invoice_slug>]
 *
 * --raw consulta a InfinitePay diretamente e imprime a resposta crua — use para
 * diagnosticar nomes de campos quando algo não confirma.
 */

import "dotenv/config";

function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.flags.add(key);
    } else {
      args.values[key] = next;
      i++;
    }
  }
  return args;
}

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`✗ Variável de ambiente ausente: ${key}`);
    process.exit(1);
  }
  return value;
}

function getBaseUrl() {
  return (process.env.BASE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* resposta não-JSON */
  }
  return { status: res.status, json, text };
}

/** Consulta crua na InfinitePay — mostra exatamente o que a API devolve. */
async function raw({ orderNsu, transactionNsu, slug }) {
  const handle = requireEnv("INFINITEPAY_HANDLE");
  const apiUrl = (process.env.INFINITEPAY_API_URL ?? "https://api.checkout.infinitepay.io")
    .trim()
    .replace(/\/+$/, "");

  const body = {
    handle,
    order_nsu: orderNsu,
    transaction_nsu: transactionNsu,
    slug: slug ?? "",
  };

  console.log(`→ POST ${apiUrl}/payment_check`);
  console.log(JSON.stringify(body, null, 2));

  const { status, json, text } = await postJson(`${apiUrl}/payment_check`, body);
  console.log(`\n← HTTP ${status}`);
  console.log(json ? JSON.stringify(json, null, 2) : text);

  if (json?.paid === true) {
    console.log("\n✓ A InfinitePay confirma: pagamento APROVADO.");
  } else {
    console.log("\n✗ A InfinitePay não confirmou o pagamento com estes parâmetros.");
  }
}

/** Reconcilia um pedido específico via endpoint real da aplicação. */
async function reconcileOne({ orderNsu, transactionNsu, slug }) {
  const url = `${getBaseUrl()}/api/checkout/verify`;
  const body = {
    public_id: orderNsu,
    transaction_nsu: transactionNsu,
    ...(slug ? { invoice_slug: slug } : {}),
  };

  console.log(`→ POST ${url}`);
  const { status, json, text } = await postJson(url, body);
  console.log(`← HTTP ${status}`);
  console.log(json ? JSON.stringify(json, null, 2) : text);

  if (json?.paid === true) {
    console.log(`\n✓ Pedido ${orderNsu} está PAGO e já aparece no painel.`);
    return;
  }

  console.log(`\n✗ Pedido ${orderNsu} não foi confirmado.`);
  console.log("  Rode com --raw para ver a resposta crua da InfinitePay.");
  process.exitCode = 1;
}

/** Dispara uma varredura completa (mesmo caminho do cron). */
async function reconcileAll() {
  const token = requireEnv("INFINITEPAY_WEBHOOK_TOKEN");
  const url = `${getBaseUrl()}/api/cron/reconcile/${token}`;

  console.log(`→ POST ${getBaseUrl()}/api/cron/reconcile/<token>`);
  const { status, json, text } = await postJson(url, {});
  console.log(`← HTTP ${status}`);
  console.log(json ? JSON.stringify(json, null, 2) : text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const orderNsu = args.values.order?.toUpperCase();
  const transactionNsu = args.values.nsu;
  const slug = args.values.slug;

  if (args.flags.has("all")) {
    await reconcileAll();
    return;
  }

  if (!orderNsu || !transactionNsu) {
    console.error("Uso:");
    console.error("  npm run reconcile -- --order 18C50 --nsu <transaction_nsu> [--slug <slug>]");
    console.error("  npm run reconcile -- --all");
    console.error("  npm run reconcile -- --raw --order 18C50 --nsu <transaction_nsu>");
    process.exit(1);
  }

  if (args.flags.has("raw")) {
    await raw({ orderNsu, transactionNsu, slug });
    return;
  }

  await reconcileOne({ orderNsu, transactionNsu, slug });
}

main().catch((err) => {
  console.error("✗ Erro:", err.message);
  process.exit(1);
});
