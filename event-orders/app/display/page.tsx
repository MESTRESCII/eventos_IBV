import { listPaidPendingDelivery } from "@/db/repositories/orders.repository";
import { AutoRefresh } from "./_components/AutoRefresh";
import type { Order } from "@/db/repositories/orders.repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const URGENT_AFTER_MS = 60_000; // 1 minuto

function OrderCard({ order, urgent }: { order: Order; urgent: boolean }) {
  return (
    <article
      style={{
        background: "#1e293b",
        border: `2px solid ${urgent ? "#facc15" : "#38bdf8"}`,
        borderRadius: "1rem",
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        animation: urgent ? "urgentPulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      {/* Código */}
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>
        Código:{" "}
        <span
          style={{
            color: urgent ? "#facc15" : "#38bdf8",
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          {order.public_id.toUpperCase()}
        </span>
      </p>

      {/* Nome */}
      <p
        style={{
          color: "#f1f5f9",
          fontSize: "1.75rem",
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {order.customer_name}
      </p>

      {/* Itens */}
      <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#cbd5e1", fontSize: "1.1rem" }}>
        {order.items.map((item) => (
          <li key={item.id}>
            <strong>{item.quantity}×</strong> {item.product_name}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default async function DisplayPage() {
  const orders = await listPaidPendingDelivery();
  const now = Date.now();

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
      <style>{`
        @keyframes urgentPulse {
          0%, 100% {
            box-shadow: 0 0 8px 2px rgba(250, 204, 21, 0.7);
            border-color: #facc15;
          }
          50% {
            box-shadow: 0 0 20px 6px rgba(254, 249, 195, 0.4);
            border-color: #fef9c3;
          }
        }
      `}</style>

      {/* Auto-refresh a cada 10 segundos */}
      <AutoRefresh intervalMs={10_000} />

      {/* Cabeçalho */}
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, color: "#f8fafc" }}>
          🍽️ Pedidos Prontos para Retirada
        </h1>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.25rem",
            maxWidth: "1400px",
            margin: "0 auto",
          }}
        >
          {orders.map((order) => {
            const urgent =
              !!order.paid_at && now - new Date(order.paid_at).getTime() > URGENT_AFTER_MS;
            return <OrderCard key={order.id} order={order} urgent={urgent} />;
          })}
        </div>
      )}

      {/* Rodapé com contagem */}
      {orders.length > 0 && (
        <footer
          style={{ textAlign: "center", marginTop: "2rem", color: "#475569", fontSize: "0.9rem" }}
        >
          {orders.length} pedido{orders.length !== 1 ? "s" : ""} aguardando retirada
        </footer>
      )}
    </div>
  );
}
