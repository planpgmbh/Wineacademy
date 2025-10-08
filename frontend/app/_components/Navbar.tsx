import Link from "next/link";
import type { ReactNode } from "react";
import { CartButton } from "./CartButton";
import type { NavigationItem, NavigationSubItem } from "../_lib/cms";

const FALLBACK_NAVIGATION: NavigationItem[] = [
  { titel: "Wine Academy", link: "/", ziel: "_self", unterpunkte: [] },
  { titel: "Ausbildung", link: "/ausbildung", ziel: "_self", unterpunkte: [] },
  { titel: "Kurse", link: "/kurse", ziel: "_self", unterpunkte: [] },
  { titel: "Events", link: "/events", ziel: "_self", unterpunkte: [] },
  { titel: "Gutscheine", link: "/gutscheine", ziel: "_self", unterpunkte: [] },
  { titel: "Kontakt", link: "/kontakt", ziel: "_self", unterpunkte: [] },
];

const SOCIAL_LINKS: Array<{
  label: string;
  href: string;
  icon: ReactNode;
}> = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/wine.academy.hamburg/",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" />
        <circle cx="12" cy="12" r="3.75" />
        <circle cx="17.25" cy="6.75" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/wineacademyhamburg/",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M9 8h2V6.5C11 5.1 11.9 4 13.8 4H16v3h-2c-.6 0-1 .4-1 1V8h3l-.5 3H13v9h-3v-9H7V8h2Z" />
      </svg>
    ),
  },
  {
    label: "E-Mail",
    href: "mailto:post@wineacademy.de",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
        <path d="m4 7 8 5 8-5" />
      </svg>
    ),
  },
];

function ExternalIconLink({ label, href, icon }: { label: string; href: string; icon: ReactNode }) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="btn btn-ghost btn-circle"
      aria-label={label}
    >
      {icon}
    </a>
  );
}

type LinkProps = {
  label: string;
  link: string | null;
  ziel: "_self" | "_blank";
  className?: string;
};

function NavLink({ label, link, ziel, className }: LinkProps) {
  if (!link) {
    return <span className={className}>{label}</span>;
  }
  const isExternal = link.startsWith("http");
  const target = ziel === "_blank" ? "_blank" : undefined;
  const rel = target === "_blank" || isExternal ? "noopener noreferrer" : undefined;
  return (
    <Link href={link} prefetch={false} className={className} target={target} rel={rel}>
      {label}
    </Link>
  );
}

function MenuChildren({ items }: { items: NavigationSubItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="menu menu-compact rounded-box bg-base-100 p-2 shadow lg:menu-normal lg:min-w-56">
      {items.map((child) => (
        <li key={`${child.titel}-${child.link ?? "nolink"}`}>
          <NavLink label={child.titel} link={child.link} ziel={child.ziel} className="rounded-btn" />
        </li>
      ))}
    </ul>
  );
}

function DesktopMenu({ items }: { items: NavigationItem[] }) {
  return (
    <ul className="menu menu-horizontal px-1">
      {items.map((item) => {
        const hasChildren = item.unterpunkte.length > 0;
        const key = `${item.titel}-${item.link ?? "nolink"}`;
        if (!hasChildren) {
          return (
            <li key={key}>
              <NavLink label={item.titel} link={item.link} ziel={item.ziel} className="rounded-btn" />
            </li>
          );
        }
        return (
          <li key={key}>
            <details>
              <summary className="rounded-btn">
                {item.titel}
              </summary>
              <MenuChildren
                items={[{ titel: item.titel, link: item.link, ziel: item.ziel }, ...item.unterpunkte]}
              />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function MobileMenu({ items }: { items: NavigationItem[] }) {
  return (
    <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 w-64 rounded-box bg-base-100 p-2 shadow">
      {items.map((item) => {
        const key = `${item.titel}-${item.link ?? "nolink"}`;
        const hasChildren = item.unterpunkte.length > 0;
        return (
          <li key={key}>
            <NavLink label={item.titel} link={item.link} ziel={item.ziel} className="font-semibold" />
            {hasChildren && (
              <ul className="pl-2">
                {item.unterpunkte.map((child) => (
                  <li key={`${key}-${child.titel}-${child.link ?? "nolink"}`}>
                    <NavLink label={child.titel} link={child.link} ziel={child.ziel} className="text-sm" />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      <li className="mt-2 border-t border-base-200 pt-2">
        <div className="flex items-center gap-2">
          {SOCIAL_LINKS.map((link) => (
            <ExternalIconLink key={link.label} {...link} />
          ))}
        </div>
      </li>
    </ul>
  );
}

export function Navbar({ items }: { items: NavigationItem[] }) {
  const navItems = items.length > 0 ? items : FALLBACK_NAVIGATION;

  return (
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <MobileMenu items={navItems} />
          </div>
          <Link href="/" className="btn btn-ghost text-xl" prefetch={false}>
            Wine Academy
          </Link>
        </div>
        <div className="navbar-center hidden lg:flex">
          <DesktopMenu items={navItems} />
        </div>
        <div className="navbar-end gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {SOCIAL_LINKS.map((link) => (
              <ExternalIconLink key={link.label} {...link} />
            ))}
          </div>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
