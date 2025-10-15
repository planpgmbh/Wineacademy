"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { CartIcon, InstagramIcon, LinkedinIcon, MailIcon } from "./icons";

type NavigationLink = {
  label: string;
  href: string;
};

const navigationLinks: NavigationLink[] = [
  { label: "Wine Academy", href: "/wine-academy" },
  { label: "Ausbildung", href: "/ausbildung" },
  { label: "Kurse", href: "/kurse" },
  { label: "Events", href: "/events" },
  { label: "Gutscheine", href: "/gutscheine" }
];

export function Navbar() {
  // TODO: Replace with real cart state once CartProvider is available.
  const cartCount = 0;

  const handleCartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (typeof window !== "undefined") {
      document.dispatchEvent(new CustomEvent("cart:toggle"));
    }
  };

  return (
    <nav className="navbar border-b border-base-200 bg-base-100 px-8">
      <div className="navbar-start gap-3">
        <div className="dropdown md:hidden">
          <button type="button" className="btn btn-ghost btn-circle" tabIndex={0}>
            <span className="sr-only">Navigation öffnen</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-6"
              stroke="currentColor"
              strokeWidth={1.5}
              fill="none"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <ul
            tabIndex={0}
            className="menu dropdown-content menu-sm z-[1] mt-3 w-52 rounded-box bg-base-100 p-2 shadow"
          >
            {navigationLinks.map((link) => (
              <li key={`mobile-${link.label}`}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icons/WineAcademy.svg"
            alt="Wine Academy"
            priority
            width={108}
            height={70}
            className="h-12 w-auto"
          />
        </Link>
      </div>

      <div className="navbar-center">
        <ul className="menu menu-horizontal hidden gap-6 px-1 text-sm font-medium text-base-content md:flex">
          {navigationLinks.map((link) => (
            <li key={link.label}>
              <Link href={link.href} className="flex items-center gap-1">
                <span>{link.label}</span>
                <span className="text-base-content/60">▾</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="navbar-end">
        <div className="flex items-center gap-2">
          <a href="mailto:" aria-label="E-Mail schreiben" className="btn btn-ghost btn-circle">
            <MailIcon className="size-5" />
          </a>
          <a
            href="https://www.instagram.com/wineacademy"
            aria-label="Instagram"
            className="btn btn-ghost btn-circle"
            target="_blank"
            rel="noreferrer"
          >
            <InstagramIcon className="size-5" />
          </a>
          <a
            href="https://www.linkedin.com/company/wineacademy"
            aria-label="LinkedIn"
            className="btn btn-ghost btn-circle"
            target="_blank"
            rel="noreferrer"
          >
            <LinkedinIcon className="size-5" />
          </a>
          <button
            type="button"
            aria-label="Warenkorb"
            className="btn btn-ghost btn-circle relative"
            onClick={handleCartClick}
          >
            {cartCount > 0 ? (
              <span className="badge badge-primary badge-xs absolute -right-1 -top-1">{cartCount}</span>
            ) : null}
            <CartIcon className="size-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
