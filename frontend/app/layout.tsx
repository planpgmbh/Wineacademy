import type { Metadata } from "next";
import { Navbar } from "./_components/Navbar";
import { CartSlideout } from "./_components/CartSlideout";
import { CartProvider } from "./_components/CartProvider";
import { Footer } from "./_components/Footer";
import { fetchFooter, fetchNavigation } from "./_lib/cms";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Academy Hamburg",
  description: "Weinwissen, Seminare und Veranstaltungen neu gedacht.",
};

export const revalidate = 0;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [navigation, footer] = await Promise.all([fetchNavigation(), fetchFooter()]);

  return (
    <html lang="de" data-theme="light">
      <body className="bg-base-200 text-base-content antialiased">
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar items={navigation.items} />
            <CartSlideout />
            <main className="flex-1">{children}</main>
            <Footer sections={footer.sections} />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
