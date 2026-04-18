import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Espressonism | Artisanal Coffee Rituals",
  description:
    "Espressonism crafts bold, modern coffee rituals with small-batch beans and precision brewing."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <html lang="en">
      <body>
        {children}
        {isProduction ? <Analytics /> : null}
      </body>
    </html>
  );
}
