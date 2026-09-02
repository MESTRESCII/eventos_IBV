import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Eventos IBV — Pedidos",
  description: "Sistema de venda antecipada para eventos IBV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geist.variable} font-[var(--font-geist)] antialiased`}
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
