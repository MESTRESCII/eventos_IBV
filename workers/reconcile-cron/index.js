/**
 * Worker-companheiro: aciona a reconciliação de pagamentos da aplicação a cada minuto.
 *
 * Existe separado porque o build OpenNext do Next.js não expõe um handler `scheduled`,
 * então o Cron Trigger não pode viver no worker principal. Este worker não tem lógica
 * de negócio — só chama o endpoint e registra o resultado.
 *
 * Configuração (uma vez), a partir de event-orders/ — note o `../`, pois este worker
 * vive na RAIZ do repositório, fora de event-orders:
 *
 *   npx wrangler deploy --config ../workers/reconcile-cron/wrangler.toml
 *   npx wrangler secret put RECONCILE_URL --config ../workers/reconcile-cron/wrangler.toml
 *   valor: https://<seu-dominio>/api/cron/reconcile/<INFINITEPAY_WEBHOOK_TOKEN>
 *
 * Nesta ordem: o segredo só pode ser gravado depois que o worker existe na Cloudflare.
 */
export default {
  async scheduled(_event, env, _ctx) {
    if (!env.RECONCILE_URL) {
      console.error("[reconcile-cron] RECONCILE_URL não configurado");
      return;
    }

    try {
      const res = await fetch(env.RECONCILE_URL, { method: "POST" });
      const body = await res.text();

      if (!res.ok) {
        console.error(`[reconcile-cron] HTTP ${res.status}: ${body.slice(0, 300)}`);
        return;
      }

      const result = JSON.parse(body);
      // Silencioso quando não há nada a fazer — evita poluir os logs a cada minuto.
      if (result.confirmed > 0 || result.failed > 0) {
        console.log(`[reconcile-cron] ${body}`);
      }
    } catch (err) {
      console.error("[reconcile-cron] Falha:", err.message);
    }
  },
};
