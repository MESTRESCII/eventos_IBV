"use client";

type OrderItem = {
  id: string;
  quantity: number;
  product_name: string;
  subtotal: string | number;
};

type Props = {
  publicId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: string | number;
  isPaid: boolean;
  pickupDate: string;
};

/* ── rounded rect helper ─────────────────────────────────────────── */
function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | { tl: number; tr: number; bl: number; br: number },
) {
  const rad = typeof r === "number" ? { tl: r, tr: r, bl: r, br: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl);
  ctx.quadraticCurveTo(x, y, x + rad.tl, y);
  ctx.closePath();
}

function hline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.strokeStyle = "#E8DFC8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + w, y + 0.5);
  ctx.stroke();
}

/* ── canvas drawing ──────────────────────────────────────────────── */
function drawReceipt(props: Props): string {
  const { publicId, customerName, items, totalAmount, isPaid, pickupDate } = props;

  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const W = 540;
  const CARD_X = 24;
  const CARD_W = W - 48;
  const HEADER_H = 52;
  const ITEM_H = 30;
  const BADGE_H = isPaid ? 48 : 68;

  const CARD_H =
    HEADER_H + // header band
    24 + // gap
    16 + // "PEDIDO" label
    52 + // public_id big
    20 + // customer name
    20 + // gap before divider
    20 + // gap after divider
    items.length * ITEM_H +
    20 + // gap after items (before divider)
    20 + // gap after total divider
    28 + // total row
    24 + // gap
    BADGE_H +
    24 + // gap
    20 + // pickup date
    24; // bottom padding

  const H = CARD_H + 60; // 30px top + 30px bottom margin

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  /* background */
  ctx.fillStyle = "#FAF6F0";
  ctx.fillRect(0, 0, W, H);

  const CARD_Y = 30;

  /* card shadow + body */
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#FFFFFF";
  rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  /* header band */
  ctx.fillStyle = "#7A5F10";
  rr(ctx, CARD_X, CARD_Y, CARD_W, HEADER_H, { tl: 16, tr: 16, bl: 0, br: 0 });
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.fillText("IBV 2026", CARD_X + 20, CARD_Y + 22);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.fillText("Pedidos antecipados", CARD_X + 20, CARD_Y + 40);

  let y = CARD_Y + HEADER_H + 24;

  /* "PEDIDO" label */
  ctx.fillStyle = "#9B8A6A";
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.fillText("PEDIDO", CARD_X + 20, y);
  y += 16;

  /* public_id */
  ctx.fillStyle = "#7A5F10";
  ctx.font = "bold 44px 'Courier New', 'Lucida Console', monospace";
  ctx.fillText(publicId.toUpperCase(), CARD_X + 20, y + 40);
  y += 52;

  /* customer name */
  ctx.fillStyle = "#6B5B3A";
  ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.fillText(customerName, CARD_X + 20, y);
  y += 20;

  /* divider */
  hline(ctx, CARD_X + 16, y, CARD_W - 32);
  y += 20;

  /* items */
  for (const item of items) {
    ctx.fillStyle = "#3D2E0E";
    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${item.quantity}× ${item.product_name}`, CARD_X + 20, y);
    ctx.textAlign = "right";
    ctx.fillText(
      `R$ ${Number(item.subtotal).toFixed(2).replace(".", ",")}`,
      CARD_X + CARD_W - 20,
      y,
    );
    ctx.textAlign = "left";
    y += ITEM_H;
  }

  /* total divider */
  hline(ctx, CARD_X + 16, y, CARD_W - 32);
  y += 20;

  /* total row */
  ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#3D2E0E";
  ctx.textAlign = "left";
  ctx.fillText("Total", CARD_X + 20, y);
  ctx.fillStyle = "#7A5F10";
  ctx.textAlign = "right";
  ctx.fillText(`R$ ${Number(totalAmount).toFixed(2).replace(".", ",")}`, CARD_X + CARD_W - 20, y);
  ctx.textAlign = "left";
  y += 32;

  /* status badge */
  if (isPaid) {
    rr(ctx, CARD_X + 16, y, CARD_W - 32, 48, 10);
    ctx.fillStyle = "#F0FDF4";
    ctx.fill();
    ctx.strokeStyle = "#86EFAC";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#166534";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    ctx.fillText("✅  Pagamento confirmado", CARD_X + 28, y + 30);
    y += 48 + 24;
  } else {
    rr(ctx, CARD_X + 16, y, CARD_W - 32, 68, 10);
    ctx.fillStyle = "#FEFBF0";
    ctx.fill();
    ctx.strokeStyle = "#D4B86A";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#7A5F10";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    ctx.fillText("⏳  Aguardando pagamento", CARD_X + 28, y + 26);
    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#8B7040";
    ctx.fillText(`Guarde o código: ${publicId.toUpperCase()}`, CARD_X + 28, y + 48);
    y += 68 + 24;
  }

  /* pickup date */
  const dateStr = new Date(pickupDate).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  ctx.fillStyle = "#9B8A6A";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Retirada: ${dateStr}`, W / 2, y);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

/* ── component ───────────────────────────────────────────────────── */
export function ReceiptDownload(props: Props) {
  function handleDownload() {
    const dataUrl = drawReceipt(props);
    const filename = `comprovante-${props.publicId.toLowerCase()}.png`;

    // Modern API (works in desktop and Android Chrome)
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all hover:opacity-80 flex items-center justify-center gap-2"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <span>📄</span>
      Baixar comprovante
    </button>
  );
}
