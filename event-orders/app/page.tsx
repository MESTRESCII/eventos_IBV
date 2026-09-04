import { findActiveProducts } from "@/db/repositories/products.repository";
import { ProductList } from "@/components/catalog/ProductList";
import { isCutoffPassed, isWithinWarningWindow, timeUntilCutoff } from "@/libs/cutoff";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await findActiveProducts();
  const passed = isCutoffPassed();
  const warning = isWithinWarningWindow();
  const timeLeft = warning ? timeUntilCutoff() : null;

  return (
    <>
      {/* Header */}
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div>
            <p className="font-semibold text-base leading-tight">IBV 2026</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Pedidos antecipados
            </p>
          </div>
        </div>
      </header>

      {/* Banner de prazo encerrado */}
      {passed && (
        <div className="border-b" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-base">🚫</span>
            <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
              Pedidos antecipados encerrados.{" "}
              <span className="font-normal">
                O prazo foi até quarta-feira às 23h59. Você poderá pagar no dia do evento.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Banner de aviso (48h antes) */}
      {!passed && warning && timeLeft && (
        <div className="border-b" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
              Pedidos encerram em {timeLeft.hours}h
              {timeLeft.minutes > 0 ? ` ${timeLeft.minutes}min` : ""}.{" "}
              <span className="font-normal">Finalize logo para garantir o seu.</span>
            </p>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        <h1 className="text-xl font-bold mb-1">Cardápio</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          {passed
            ? "Você ainda pode ver o cardápio. Pagamentos serão realizados no dia do evento."
            : "Escolha os itens e finalize seu pedido"}
        </p>
        <ProductList products={products} cutoffPassed={passed} />
      </main>
    </>
  );
}
