import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { serifBabe } from "./fonts";
import { CartDrawerProvider } from "@/components/cart/CartDrawerProvider";
import { Navbar } from "@/components/navigation/Navbar";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { getNavigation } from "@/lib/navigation";
import { PageTransition } from "@/components/animations/PageTransition";

export const metadata: Metadata = {
  title: "Wine Academy Frontend",
  description: "Frischer Next.js-Start mit Tailwind CSS und DaisyUI.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const navigationItems = await getNavigation();

  return (
    <html lang="de" data-theme="WineAcademy" className={serifBabe.variable}>
      <body className="flex min-h-screen flex-col bg-base-200 text-base-content antialiased">
        <Navbar items={navigationItems} />
        <div className="flex-1 overflow-hidden">
          <PageTransition>{children}</PageTransition>
        </div>
        <SiteFooter />
        <CartDrawerProvider />
      </body>
    </html>
  );
}
