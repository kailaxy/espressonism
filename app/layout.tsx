import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import "./globals.css";

const neueMontreal = localFont({
  src: [
    { path: "../asset/fonts/NeueMontreal-Light.woff2", weight: "300", style: "normal" },
    { path: "../asset/fonts/NeueMontreal-LightItalic.woff2", weight: "300", style: "italic" },
    { path: "../asset/fonts/NeueMontreal-Regular.woff2", weight: "400", style: "normal" },
    { path: "../asset/fonts/NeueMontreal-Italic.woff2", weight: "400", style: "italic" },
    { path: "../asset/fonts/NeueMontreal-Medium.woff2", weight: "500", style: "normal" },
    { path: "../asset/fonts/NeueMontreal-MediumItalic.woff2", weight: "500", style: "italic" },
    { path: "../asset/fonts/NeueMontreal-Bold.woff2", weight: "700", style: "normal" },
    { path: "../asset/fonts/NeueMontreal-BoldItalic.woff2", weight: "700", style: "italic" }
  ],
  display: "swap",
  variable: "--font-neue-montreal"
});

export const metadata: Metadata = {
  title: "Grit Coffee | Artisanal Coffee Rituals",
  description:
    "Grit Coffee crafts bold, modern coffee rituals with small-batch beans and precision brewing."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <html lang="en" className={neueMontreal.variable}>
      <body className={neueMontreal.className}>
        {children}
        {isProduction ? <Analytics /> : null}
      </body>
    </html>
  );
}
