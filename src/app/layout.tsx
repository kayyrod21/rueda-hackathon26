import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "./lib/siteConfig";
import { siteUrl } from "./lib/siteUrl";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  icons: { icon: "/brand/rueda-mark.png" },
  title: { default: "Rueda Mobility | Premium Mobility, Coordinated Instantly", template: "%s | Rueda Mobility" },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.brandName,
    title: siteConfig.brandName,
    description: siteConfig.description,
    images: [{ url: "/brand/rueda-logo-full.png", alt: siteConfig.brandName }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><noscript><style>{`#top [style*="opacity:0"] { opacity: 1 !important; transform: none !important; }`}</style></noscript>{children}</body></html>;
}
