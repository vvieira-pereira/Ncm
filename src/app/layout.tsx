import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal NCM — consulta de códigos",
  description:
    "Consulte códigos da Nomenclatura Comum do Mercosul (NCM) por descrição ou número, sem baixar planilhas.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edefeb" },
    { media: "(prefers-color-scheme: dark)", color: "#111614" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
