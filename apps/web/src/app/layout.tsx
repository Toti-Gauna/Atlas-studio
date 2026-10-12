import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/tokens.css";
import "@/styles/base.css";
import { Providers } from "@/lib/state/providers";
import { themeInitScript } from "@/lib/state/theme";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: { default: `${BRAND.product} — evidence-first AI workspace`, template: `%s · ${BRAND.product}` },
  description: "Enterprise AI workspace with verifiable sources, configurable agents, editable deliverables and per-model cost control. Eclipse Demo with fictional data.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
