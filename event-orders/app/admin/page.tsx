import { listAllOrders } from "@/db/repositories/orders.repository";
import { OrderTable } from "./_components/OrderTable";

export const dynamic = "force-dynamic";

async function handleLogout() {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { COOKIE_NAME } = await import("@/libs/session");
  (await cookies()).delete(COOKIE_NAME);
  redirect("/admin/login");
}

export default async function AdminPage() {
  const orders = await listAllOrders();

  const totalPendente = orders.filter((o) => o.payment_status === "PENDING").length;
  const totalPago = orders.filter(
    (o) => o.payment_status === "PAID" && o.order_status === "CREATED",
  ).length;
  const totalPronto = orders.filter(
    (o) => o.payment_status === "PAID" && o.order_status === "READY",
  ).length;
  const totalEntregue = orders.filter((o) => o.order_status === "DELIVERED").length;
  const totalReceita = orders
    .filter((o) => o.payment_status === "PAID")
    .reduce((acc, o) => acc + Number(o.total_amount), 0);

  return (
    <>
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-base">IBV 2026 — Painel Admin</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {orders.length} pedido{orders.length !== 1 ? "s" : ""} no total
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <a
              href="/display"
              target="_blank"
              className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--primary)" }}
            >
              Abrir Telão ↗
            </a>
            <form action={handleLogout}>
              <button
                type="submit"
                className="text-xs border rounded-lg px-3 py-1.5 transition-colors hover:bg-stone-100"
                style={{ borderColor: "var(--border)" }}
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Pendentes", value: totalPendente, color: "#92400E", bg: "#FFFBEB" },
            { label: "Pagos (cozinha)", value: totalPago, color: "#166534", bg: "#F0FDF4" },
            { label: "Prontos", value: totalPronto, color: "#92400E", bg: "#FEF3C7" },
            { label: "Entregues", value: totalEntregue, color: "#1D4ED8", bg: "#EFF6FF" },
            {
              label: "Receita",
              value: `R$ ${totalReceita.toFixed(2).replace(".", ",")}`,
              color: "#374151",
              bg: "var(--card)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border p-3"
              style={{ background: stat.bg, borderColor: "var(--border)" }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: stat.color }}>
                {stat.label}
              </p>
              <p className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <OrderTable orders={orders} />
      </main>
    </>
  );
}
