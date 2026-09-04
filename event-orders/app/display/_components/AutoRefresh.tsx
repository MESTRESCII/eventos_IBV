"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** Intervalo em milissegundos. Padrão: 30 segundos. */
  intervalMs?: number;
}

/**
 * Componente invisível que chama router.refresh() periodicamente,
 * forçando o servidor a re-buscar os pedidos sem recarregar a página.
 */
export function AutoRefresh({ intervalMs = 30_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
