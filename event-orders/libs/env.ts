/**
 * URL pública da aplicação, sempre SEM barra final.
 *
 * Uma barra final em BASE_URL gera `https://site.com//api/webhooks/...` — caminho com
 * barra dupla que não casa com a rota, fazendo o webhook da InfinitePay cair em 404 e o
 * pedido ficar preso em AWAITING_PAYMENT. Normalizar aqui evita depender de o .env estar
 * escrito da forma certa. O trim também remove o \r de arquivos .env salvos no Windows.
 */
export function getBaseUrl(): string {
  const raw = process.env.BASE_URL ?? "http://localhost:3000";
  return raw.trim().replace(/\/+$/, "");
}

/**
 * DATABASE_URL — usado apenas por drizzle-kit (migrations), nunca no runtime de Workers.
 *
 * Deliberadamente uma função, e não uma constante de módulo: como constante, a validação
 * rodava na importação e derrubava qualquer rota que importasse este arquivo em um
 * ambiente sem DATABASE_URL — como o próprio Cloudflare Workers.
 */
export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return value;
}
