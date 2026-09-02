"use client";

import { CartProvider } from "@/components/cart/CartContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
