import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-base-300 bg-base-100">
            <div className="navbar mx-auto w-full max-w-6xl px-4">
              <div className="navbar-start">
                <div className="dropdown">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-ghost lg:hidden"
                    aria-label="Navigation öffnen"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </div>
                  <ul
                    tabIndex={0}
                    className="menu menu-sm dropdown-content mt-3 w-52 rounded-box bg-base-100 p-2 shadow"
                  >
                    <li>
                      <Link href="#">Seminare</Link>
                    </li>
                    <li>
                      <Link href="#">Events</Link>
                    </li>
                    <li>
                      <Link href="#">Shop</Link>
                    </li>
                  </ul>
                </div>
                <Link href="/" className="btn btn-ghost text-xl">
                  Wine Academy
                </Link>
              </div>
              <div className="navbar-center hidden lg:flex">
                <ul className="menu menu-horizontal px-1">
                  <li>
                    <Link href="#">Seminare</Link>
                  </li>
                  <li>
                    <Link href="#">Events</Link>
                  </li>
                  <li>
                    <Link href="#">Shop</Link>
                  </li>
                </ul>
              </div>
              <div className="navbar-end gap-2">
                <Link href="#" className="btn btn-primary">
                  Kontakt
                </Link>
              </div>
            </div>
          </header>
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
      </body>
    </html>
  );
}
