import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EstoquePro — Sistema de gerenciamento de estoque",
  description:
    "Sistema profissional de gerenciamento de estoque para pequenas e médias empresas: produtos, categorias, entradas e saídas, alertas e relatórios.",
  icons: {
    icon: "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#059669"/><path d="M32 14 L48 23 V41 L32 50 L16 41 V23 Z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M16 23 L32 32 L48 23 M32 32 V50" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/></svg>'
    ),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
