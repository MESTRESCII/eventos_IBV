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
    <main className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <p className="text-xs font-mono text-zinc-400 mb-1">PEDIDO</p>
        <p className="text-3xl font-bold tracking-widest mb-1">{order.public_id}</p>
        <p className="text-sm text-zinc-500 mb-6">{order.customer_name}</p>

        <ul className="flex flex-col gap-2 mb-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.product_name}
              </span>
              <span className="font-mono">
                R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-zinc-100 pt-4 flex justify-between font-semibold mb-6">
          <span>Total</span>
          <span className="font-mono">
            R$ {Number(order.total_amount).toFixed(2).replace(".", ",")}
          </span>
        </div>

        {/* Status do pagamento */}
        {isPaid ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
            ✅ Pagamento confirmado
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 mb-1">⏳ Aguardando pagamento</p>
            <p className="text-xs text-amber-700">
              Instruções de pagamento serão disponibilizadas em breve. Guarde o código do seu
              pedido: <strong>{order.public_id}</strong>
            </p>
          </div>
        )}

        <p className="text-xs text-zinc-400 mt-4 text-center">
          Retirada: {new Date(order.pickup_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
        >
          Fazer outro pedido
        </Link>
      </div>
    </main>
  );
}
