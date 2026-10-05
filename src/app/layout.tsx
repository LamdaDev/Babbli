import type { Metadata, Viewport } from "next";
import { Fredoka, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_SC, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"] });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], weight: ["400", "500", "700", "900"], preload: false });
// Simplified Chinese: Noto Sans JP lacks many of its characters, and draws shared ones the Japanese way.
const notoSc = Noto_Sans_SC({ variable: "--font-noto-sc", subsets: ["latin"], weight: ["400", "500", "700", "900"], preload: false });
// Korean: Noto Sans JP has no Hangul at all.
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", subsets: ["latin"], weight: ["400", "500", "700", "900"], preload: false });

const title = "Babbli · Walk in. Figure out what to say.";
const description =
  "Babbli is a first-person language-practice simulator: shop in New York, order ramen in Tokyo, coffee in Paris, bubble tea in Shanghai, late-night snacks in Seoul, or check in to a hotel in Sevilla, by voice, with real characters powered by ElevenLabs.";

/**
 * The public address, so link previews (LinkedIn, X…) get a full URL for the preview image
 * (opengraph-image.png next to this file). Set BABBLI_SITE_URL; Railway's own domain is the fallback.
 */
const siteUrl = process.env.BABBLI_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  openGraph: { type: "website", siteName: "Babbli", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#f3f6fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${notoJp.variable} ${notoSc.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
