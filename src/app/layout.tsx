import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";

export const metadata: Metadata = {
  title: "ESTABLO AI — Sistema Inteligente de Gestión y Conversión de LEADS",
  description: "Plataforma de inteligencia comercial y ventas personalizadas con IA para Parrilladas El Establo (Trujillo, Perú).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased selection:bg-[#C96D35]/20 selection:text-[#C96D35]">
        <ThemeProvider>
          <AppLayout>{children}</AppLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}

