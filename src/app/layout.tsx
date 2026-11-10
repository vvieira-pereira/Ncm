import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

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
  themeColor: "#e9ebee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={body.variable} suppressHydrationWarning>
      <head>
        {/* aplica o tema salvo antes da pintura para nao piscar; padrao: claro */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ncm:tema")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
