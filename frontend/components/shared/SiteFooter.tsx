import Image from "next/image";
import Link from "next/link";
import { getFooterSections } from "@/lib/footer";

type FooterSection = Awaited<ReturnType<typeof getFooterSections>>[number];

function hasSectionContent(section: FooterSection): boolean {
  if (section.type === "kontakt") {
    return Boolean(section.text?.trim());
  }
  if (section.type === "links") {
    return section.links.length > 0;
  }
  if (section.type === "logos") {
    return section.logos.length > 0;
  }
  return false;
}

function renderKontakt(section: FooterSection) {
  if (!section.text) {
    return null;
  }
  return (
    <p className="text-sm leading-relaxed text-secondary-content/80 whitespace-pre-line">
      {section.text}
    </p>
  );
}

function renderLinks(section: FooterSection) {
  if (section.links.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {section.links.map((link) => {
        if (!link.href) {
          return (
            <li key={`${section.title}-${link.label}`}>
              <span className="text-sm text-secondary-content/70">{link.label}</span>
            </li>
          );
        }

        const rel = link.target === "_blank" ? "noreferrer noopener" : undefined;

        return (
          <li key={`${section.title}-${link.label}-${link.href}`}>
            <Link
              href={link.href}
              target={link.target === "_blank" ? "_blank" : undefined}
              rel={rel}
              className="link-hover text-sm text-secondary-content transition-colors hover:text-secondary-content"
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function renderLogos(section: FooterSection) {
  if (section.logos.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-4 md:gap-6 lg:flex-nowrap">
      {section.logos.map((logo, index) => {
        if (!logo.src) {
          return null;
        }

        const width = logo.width && logo.width > 0 ? logo.width : 160;
        const height = logo.height && logo.height > 0 ? logo.height : 100;
        const image = (
          <Image
            src={logo.src}
            alt={logo.alt ?? logo.name ?? "Zertifikat"}
            width={width}
            height={height}
            className="h-14 w-auto object-contain md:h-16"
            sizes="(max-width: 1024px) 120px, 180px"
          />
        );

        if (logo.href) {
          return (
            <Link
              key={`${section.title}-logo-${index}`}
              href={logo.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center"
            >
              {image}
            </Link>
          );
        }

        return (
          <span key={`${section.title}-logo-${index}`} className="inline-flex items-center justify-center">
            {image}
          </span>
        );
      })}
    </div>
  );
}

function renderSection(section: FooterSection) {
  if (section.type === "kontakt") {
    return renderKontakt(section);
  }
  if (section.type === "links") {
    return renderLinks(section);
  }
  if (section.type === "logos") {
    return renderLogos(section);
  }
  return null;
}

export async function SiteFooter() {
  const sections = (await getFooterSections()).filter(hasSectionContent);
  if (sections.length === 0) {
    return null;
  }

  const logoSection = sections.find((section) => section.type === "logos");
  const regularSections = sections.filter((section) => section.type !== "logos");

  return (
    <footer className="mt-12 border-t border-secondary/40 bg-secondary text-secondary-content md:mt-20">
      <div className="mx-auto max-w-screen-xl px-6 py-14 md:px-10 lg:px-12">
        <div className="footer grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {regularSections.map((section, index) => {
            const content = renderSection(section);
            if (!content) {
              return null;
            }

            return (
              <div
                key={`${section.title}-${index}`}
                className="flex flex-col gap-4 text-secondary-content/90"
              >
                <span className="footer-title text-sm uppercase tracking-widest text-secondary-content">
                  {section.title}
                </span>
                {content}
              </div>
            );
          })}

          {logoSection ? (
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-1 xl:ml-auto xl:justify-self-end">
              <div className="flex flex-col gap-4 text-right">
                <span className="footer-title text-sm uppercase tracking-widest text-secondary-content">
                  {logoSection.title}
                </span>
                {renderLogos(logoSection)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
