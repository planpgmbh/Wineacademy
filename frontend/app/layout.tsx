import type { Metadata } from "next";
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
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
