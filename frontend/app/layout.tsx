import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "./_components/Navbar";
import { CartSlideout } from "./_components/CartSlideout";
import { CartProvider } from "./_components/CartProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Academy Hamburg",
  description: "Weinwissen, Seminare und Veranstaltungen neu gedacht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-theme="light">
      <body className="bg-base-200 text-base-content antialiased">
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <CartSlideout />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-base-300 bg-base-100">
              <div className="footer mx-auto w-full max-w-6xl items-center justify-between gap-4 p-6 text-base-content">
                <aside>
                  <p className="font-semibold">Wine Academy Hamburg</p>
                  <p>Genuss und Wissen rund um Wein seit 2010.</p>
                </aside>
                <nav className="grid grid-flow-col gap-4">
                  <Link href="#" className="link link-hover">
                    Datenschutz
                  </Link>
                  <Link href="#" className="link link-hover">
                    Impressum
                  </Link>
                </nav>
              </div>
            </footer>
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
