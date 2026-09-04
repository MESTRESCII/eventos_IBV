import { listPaidPendingDelivery } from "@/db/repositories/orders.repository";
import { AutoRefresh } from "./_components/AutoRefresh";
import type { Order } from "@/db/repositories/orders.repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderCard({ order }: { order: Order }) {
  return (
    <article
      style={{
        background: "#1e293b",
        border: "2px solid #38bdf8",
        borderRadius: "1rem",
        padding: "1.5rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Código */}
      <p style={{ color: "#94a3b8", fontSize: "1rem", margin: 0 }}>
        Código:{" "}
        <span style={{ color: "#38bdf8", fontWeight: 700, fontFamily: "monospace" }}>
          {order.public_id.toUpperCase()}
        </span>
      </p>

      {/* Nome */}
      <p
        style={{ color: "#f1f5f9", fontSize: "2rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}
      >
        {order.customer_name}
      </p>

      {/* Itens */}
      <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#cbd5e1", fontSize: "1.25rem" }}>
        {order.items.map((item) => (
          <li key={item.id}>
            <strong>{item.quantity}×</strong> {item.product_name}
          </li>
        ))}
      </ul>

      {/* Total e horário */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.25rem",
        }}
      >
        <span style={{ color: "#4ade80", fontSize: "1.5rem", fontWeight: 700 }}>
          {formatCurrency(order.total_amount)}
        </span>
        {order.paid_at && (
          <span style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Pago às {formatTime(order.paid_at)}
          </span>
        )}
      </div>
    </article>
  );
}

export default async function DisplayPage() {
  const orders = await listPaidPendingDelivery();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        boxSizing: "border-box",
      }}
    >
      {/* Auto-refresh a cada 30 segundos */}
      <AutoRefresh intervalMs={30_000} />

      {/* Cabeçalho */}
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0, color: "#f8fafc" }}>
          🍽️ Pedidos Prontos para Retirada
        </h1>
        <p style={{ color: "#64748b", marginTop: "0.5rem", fontSize: "1rem" }}>
          Atualizado automaticamente a cada 30 segundos
        </p>
      </header>

      {/* Lista de pedidos */}
      {orders.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "40vh",
            gap: "1rem",
            color: "#475569",
          }}
        >
          <span style={{ fontSize: "4rem" }}>✅</span>
          <p style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>
            Nenhum pedido aguardando retirada
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "1.5rem",
            maxWidth: "1400px",
            margin: "0 auto",
          }}
        >
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Rodapé com contagem */}
      {orders.length > 0 && (
        <footer
          style={{ textAlign: "center", marginTop: "2.5rem", color: "#475569", fontSize: "1rem" }}
        >
          {orders.length} pedido{orders.length !== 1 ? "s" : ""} aguardando retirada
        </footer>
      )}
    </div>
  );
}
