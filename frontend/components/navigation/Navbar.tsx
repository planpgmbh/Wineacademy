"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import type { NavigationItem, NavigationLink } from "@/lib/navigation";
import { CartIcon, InstagramIcon, LinkedinIcon, MailIcon } from "./icons";

type NavbarProps = {
  items: NavigationItem[];
};

type AnchorProps = {
  item: NavigationLink;
  className?: string;
  tabIndex?: number;
  children?: ReactNode;
};

function NavigationAnchor({ item, className, tabIndex, children }: AnchorProps) {
  const rel = item.target === "_blank" ? "noreferrer noopener" : undefined;

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        tabIndex={tabIndex}
        target={item.target === "_blank" ? "_blank" : undefined}
        rel={rel}
      >
        {children ?? item.title}
      </Link>
    );
  }

  return (
    <span className={className} tabIndex={tabIndex}>
      {children ?? item.title}
    </span>
  );
}

type MobileMenuItemProps = {
  item: NavigationItem;
  index: number;
  isOpen: boolean;
  onToggle: (index: number) => void;
};

function MobileMenuItem({ item, index, isOpen, onToggle }: MobileMenuItemProps) {
  const hasSubItems = item.subItems.length > 0;
  const submenuId = `mobile-sub-${index}`;

  return (
    <li className="border-b border-base-200 last:border-none py-1">
      <div className="flex items-center justify-between gap-2">
        <NavigationAnchor
          item={item}
          className="py-2 text-base font-medium transition hover:text-primary"
        />
        {hasSubItems ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            aria-expanded={isOpen}
            aria-controls={submenuId}
            onClick={() => onToggle(index)}
          >
            <span className="sr-only">
              Untermenü für {item.title.length > 0 ? item.title : "Navigationseintrag"} umschalten
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              stroke="currentColor"
              strokeWidth={1.5}
              fill="none"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : null}
      </div>
      {hasSubItems && isOpen ? (
        <ul
          id={submenuId}
          className="ml-3 mt-2 space-y-1 border-l border-base-200 pl-3 text-sm text-base-content/80"
        >
          {item.subItems.map((subItem, subIndex) => (
            <li key={`mobile-${index}-${subIndex}`}>
              <NavigationAnchor
                item={subItem}
                className="block rounded py-1 hover:text-primary focus:text-primary focus:outline-none"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Navbar({ items }: NavbarProps) {
  const desktopLinkClass =
    "inline-flex h-10 items-center px-3 transition hover:text-primary focus:text-primary focus:outline-none";

  const [cartCount, setCartCount] = useState(0);
  const [openMobileSections, setOpenMobileSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const readCartCount = () => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("cart:count") : null;
        const parsed = raw ? Number.parseInt(raw, 10) : 0;
        setCartCount(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
      } catch {
        setCartCount(0);
      }
    };

    const handleCartCountEvent = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.count === "number") {
        setCartCount(Math.max(0, Math.trunc(event.detail.count)));
        try {
          window.localStorage.setItem("cart:count", String(Math.max(0, Math.trunc(event.detail.count))));
        } catch {
          // Ignorieren, persistenter Speicher nicht verfügbar.
        }
      } else if (!(event instanceof CustomEvent)) {
        readCartCount();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "cart:count") {
        readCartCount();
      }
    };

    document.addEventListener("cart:count", handleCartCountEvent as EventListener);
    window.addEventListener("storage", handleStorage);
    readCartCount();

    return () => {
      document.removeEventListener("cart:count", handleCartCountEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleCartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (typeof window !== "undefined") {
      document.dispatchEvent(new CustomEvent("cart:toggle"));
    }
  };

  const toggleMobileSection = (index: number) => {
    setOpenMobileSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <nav className="navbar border-b border-base-200 bg-base-100 px-4 md:px-8">
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
            className="menu dropdown-content menu-sm z-[1] mt-3 w-64 rounded-box bg-base-100 p-4 shadow"
          >
            {items.map((item, index) => (
              <MobileMenuItem
                key={`mobile-${index}-${item.title}`}
                item={item}
                index={index}
                isOpen={openMobileSections.has(index)}
                onToggle={toggleMobileSection}
              />
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
        <ul className="hidden items-center gap-1 text-sm font-medium text-base-content md:flex">
          {items.map((item, index) => {
            const hasSubItems = item.subItems.length > 0;
            if (hasSubItems) {
              return (
                <li
                  key={`desktop-${index}-${item.title}`}
                  className="group relative flex items-center"
                >
                  <NavigationAnchor item={item} className={desktopLinkClass} tabIndex={0} />
                  <ul className="absolute left-0 top-full z-10 mt-3 hidden min-w-[14rem] flex-col gap-1 rounded-box bg-base-100 p-3 text-sm shadow-md group-hover:flex group-focus-within:flex">
                    {item.subItems.map((subItem, subIndex) => (
                      <li key={`desktop-${index}-${subIndex}`}>
                        <NavigationAnchor
                          item={subItem}
                          className="block rounded-lg px-3 py-2 transition hover:bg-base-200 focus:bg-base-200 focus:outline-none"
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }

            return (
              <li key={`desktop-${index}-${item.title}`} className="flex items-center">
                <NavigationAnchor item={item} className={desktopLinkClass} />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="navbar-end">
        <div className="flex items-center gap-0">
          <a href="mailto:" aria-label="E-Mail schreiben" className="btn btn-ghost btn-circle btn-sm">
            <MailIcon className="size-5" />
          </a>
          <a
            href="https://www.instagram.com/wineacademy"
            aria-label="Instagram"
            className="btn btn-ghost btn-circle btn-sm"
            target="_blank"
            rel="noreferrer"
          >
            <InstagramIcon className="size-5" />
          </a>
          <a
            href="https://www.linkedin.com/company/wineacademy"
            aria-label="LinkedIn"
            className="btn btn-ghost btn-circle btn-sm"
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
