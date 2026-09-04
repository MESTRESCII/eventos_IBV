"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao entrar.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl border p-8 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="font-bold text-lg mb-1">IBV 2026</p>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Painel administrativo
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor="pw">
                Senha de acesso
              </label>
              <input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              />
            </div>

            {error && (
              <p
                className="text-sm rounded-lg border px-3 py-2"
                style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="rounded-lg py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
