import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ public_id: string }> };

export default async function OrderPage({ params }: Props) {
  const { public_id } = await params;
  const order = await findOrderByPublicId(public_id.toUpperCase());

  if (!order) notFound();

  const isPaid = order.payment_status === "PAID";

  return (
    <>
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-md mx-auto px-4 py-4">
          <p className="font-semibold text-sm">IBV 2026</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Pedidos antecipados
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        {/* Card principal */}
        <div
          className="rounded-xl border p-6 shadow-sm mb-6"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Código do pedido */}
          <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--muted)" }}
            >
              Pedido
            </p>
            <p
              className="text-4xl font-bold tracking-widest tabular-nums"
              style={{ color: "var(--primary)" }}
            >
              {order.public_id}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {order.customer_name}
            </p>
          </div>

          {/* Itens */}
          <ul className="flex flex-col gap-2 mb-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}× {item.product_name}
                </span>
                <span className="font-mono tabular-nums">
                  R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
                </span>
              </li>
            ))}
          </ul>

          <div
            className="border-t pt-4 flex justify-between font-semibold text-sm mb-5"
            style={{ borderColor: "var(--border)" }}
          >
            <span>Total</span>
            <span className="font-mono tabular-nums" style={{ color: "var(--primary)" }}>
              R$ {Number(order.total_amount).toFixed(2).replace(".", ",")}
            </span>
          </div>

          {/* Status de pagamento */}
          {isPaid ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
              ✅ Pagamento confirmado
            </div>
          ) : (
            <div
              className="rounded-lg border px-4 py-3"
              style={{ background: "#FEFBF0", borderColor: "#D4B86A" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "#7A5F10" }}>
                ⏳ Aguardando pagamento
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#8B7040" }}>
                Instruções de pagamento serão disponibilizadas em breve. Guarde o código do seu
                pedido: <strong className="font-bold">{order.public_id}</strong>
              </p>
            </div>
          )}

          {/* Data de retirada */}
          <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
            Retirada:{" "}
            {new Date(order.pickup_date).toLocaleDateString("pt-BR", {
              timeZone: "UTC",
            })}
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--primary)" }}
          >
            Fazer outro pedido
          </Link>
        </div>
      </main>
    </>
  );
}
