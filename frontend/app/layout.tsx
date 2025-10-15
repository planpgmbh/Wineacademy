import type { Metadata } from "next";
import { CartDrawerProvider } from "@/components/cart/CartDrawerProvider";
import { Navbar } from "@/components/navigation/Navbar";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Academy Frontend",
  description: "Frischer Next.js-Start mit Tailwind CSS und DaisyUI."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-theme="WineAcademy">
      <body className="bg-base-200 text-base-content antialiased">
        <Navbar />
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-8 py-12">{children}</main>
        <CartDrawerProvider />
      </body>
    </html>
  );
}
