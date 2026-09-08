import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { notFound } from "next/navigation";
import { ConfirmacaoClient } from "./_components/ConfirmacaoClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ public_id: string }>;
  searchParams: Promise<{
    receipt_url?: string;
    transaction_nsu?: string;
    slug?: string;
  }>;
};

export default async function ConfirmacaoPage({ params, searchParams }: Props) {
  const { public_id } = await params;
  const { receipt_url, transaction_nsu, slug } = await searchParams;
  const publicId = public_id.toUpperCase();

  const order = await findOrderByPublicId(publicId);
  if (!order) notFound();

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
        <ConfirmacaoClient
          publicId={publicId}
          initialStatus={order.payment_status}
          customerName={order.customer_name}
          totalAmount={order.total_amount}
          receiptUrl={receipt_url}
          transactionNsu={transaction_nsu}
          invoiceSlug={slug}
          items={order.items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            product_name: i.product_name,
            subtotal: i.subtotal,
          }))}
          pickupDate={order.pickup_date}
        />
      </main>
    </>
  );
}
