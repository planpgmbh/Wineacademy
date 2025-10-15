import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Academy Frontend",
  description: "Frischer Next.js-Start mit Tailwind CSS und DaisyUI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-theme="light">
      <body>
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-4xl font-semibold text-primary">Wine Academy</h1>
            <p className="text-base-content/70">
              Neu aufgesetztes Frontend. Nutze DaisyUI-Klassen als Ausgangspunkt.
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-base-300 pt-6 text-center text-sm text-base-content/60">
            © {new Date().getFullYear()} Wine Academy Hamburg
          </footer>
        </div>
      </body>
    </html>
  );
}
