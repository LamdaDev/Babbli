import type { Metadata, Viewport } from "next";
import { Fredoka, Noto_Sans_JP, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"] });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], weight: ["400", "500", "700", "900"], preload: false });

export const metadata: Metadata = {
  title: "Babbli · Walk in. Figure out what to say.",
  description:
    "Babbli is a first-person language-practice simulator: shop in New York, order ramen in Tokyo, coffee in Paris, or check in to a hotel in Sevilla, by voice, with real characters powered by ElevenLabs.",
};

export const viewport: Viewport = {
  themeColor: "#f3f6fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${notoJp.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
