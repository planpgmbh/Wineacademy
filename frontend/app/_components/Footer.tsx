import Link from "next/link";
import Image from "next/image";
import type { FooterSection, FooterLink, FooterLogo } from "../_lib/cms";
import { resolveMediaUrl } from "../_lib/cms";

function FooterLinkList({ links }: { links: FooterLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav className="flex flex-col gap-1" aria-label="Footer Links">
      {links.map((link) => {
        const target = link.ziel === "_blank" ? "_blank" : undefined;
        const rel = target === "_blank" ? "noopener noreferrer" : undefined;
        return (
          <Link key={`${link.label}-${link.href}`} href={link.href} prefetch={false} className="link link-hover"
            target={target}
            rel={rel}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FooterContact({ text }: { text: string | null }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  return (
    <address className="not-italic leading-relaxed">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </address>
  );
}

function FooterLogos({ logos }: { logos: FooterLogo[] }) {
  if (logos.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {logos.map((logo) => {
        const src = resolveMediaUrl(logo.logo?.url ?? null);
        const alt = logo.logo?.alternativeText ?? logo.name ?? "Zertifikat";
        const link = logo.href ?? undefined;
        const content = src ? (
          <Image
            src={src}
            alt={alt ?? ""}
            width={logo.logo?.width ?? 120}
            height={logo.logo?.height ?? 80}
            className="h-16 w-auto object-contain"
          />
        ) : (
          <span className="font-semibold">{logo.name ?? "Zertifikat"}</span>
        );
        if (link) {
          return (
            <a
              key={`${logo.name ?? alt}-${link}`}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              {content}
            </a>
          );
        }
        return (
          <div key={`${logo.name ?? alt}-static`} className="flex items-center">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function Section({ section }: { section: FooterSection }) {
  return (
    <div className="flex min-w-[12rem] flex-col gap-2">
      <p className="font-semibold uppercase tracking-wide text-sm text-base-content/80">
        {section.titel}
      </p>
      {section.typ === "kontakt" && <FooterContact text={section.text} />}
      {section.typ === "links" && <FooterLinkList links={section.links} />}
      {section.typ === "logos" && <FooterLogos logos={section.logos} />}
    </div>
  );
}

export function Footer({ sections }: { sections: FooterSection[] }) {
  if (sections.length === 0) {
    return (
      <footer className="border-t border-base-300 bg-base-100">
        <div className="footer mx-auto w-full max-w-6xl items-center justify-between gap-4 p-6 text-base-content">
          <aside>
            <p className="font-semibold">Wine Academy Hamburg</p>
            <p>Genuss und Wissen rund um Wein seit 2010.</p>
          </aside>
          <nav className="grid grid-flow-col gap-4">
            <Link href="/datenschutz" className="link link-hover" prefetch={false}>
              Datenschutz
            </Link>
            <Link href="/impressum" className="link link-hover" prefetch={false}>
              Impressum
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-base-300 bg-base-100">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-8 px-6 py-10 text-base-content">
        {sections.map((section) => (
          <Section key={section.titel} section={section} />
        ))}
      </div>
    </footer>
  );
}
