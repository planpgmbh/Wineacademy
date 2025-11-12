import Image from "next/image";
import type { CSSProperties } from "react";

const GRAIN_TEXTURE_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+CiAgPGZpbHRlciBpZD0nbic+CiAgICA8ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPSczJy8+CiAgPC9maWx0ZXI+CiAgPHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyBmaWx0ZXI9J3VybCgjbiknIG9wYWNpdHk9JzAuMTgnLz4KPC9zdmc+Cg==";

type DetailPageHeroProps = {
  title: string;
  paragraphs: string[];
  breadcrumbs: string[];
  contentClassName?: string;
  useContainer?: boolean;
  withSidebarPlaceholder?: boolean;
  backgroundImageUrl?: string | null;
  backgroundImageAlt?: string | null;
  mediaImageUrl?: string | null;
  mediaImageAlt?: string | null;
  callToAction?: {
    label: string;
    href: string;
  };
  preferDarkMode?: boolean;
};

export function DetailPageHero({
  title,
  paragraphs,
  breadcrumbs,
  contentClassName = "",
  useContainer = true,
  withSidebarPlaceholder = true,
  backgroundImageUrl,
  backgroundImageAlt,
  mediaImageUrl,
  mediaImageAlt,
  callToAction,
  preferDarkMode = false
}: DetailPageHeroProps) {
  const sanitiseUrl = (candidate?: string | null): string | null => {
    if (typeof candidate !== "string") {
      return null;
    }
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.includes("undefined") || trimmed.includes("null")) {
      return null;
    }
    return trimmed;
  };

  const isPlaceholder = (url: string | null, alt?: string | null): boolean => {
    if (!url) {
      return false;
    }
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("favicon") || lowerUrl.includes("logo")) {
      return true;
    }
    const altText = alt?.toLowerCase() ?? "";
    if (altText.includes("platzhalter") || altText.includes("placeholder") || altText.includes("logo")) {
      return true;
    }
    return false;
  };

  const rawMediaUrl = sanitiseUrl(mediaImageUrl);
  const rawBackgroundUrl = sanitiseUrl(backgroundImageUrl);

  let resolvedMediaUrl = rawMediaUrl && !isPlaceholder(rawMediaUrl, mediaImageAlt) ? rawMediaUrl : null;
  const resolvedBackgroundUrl =
    rawBackgroundUrl && !isPlaceholder(rawBackgroundUrl, backgroundImageAlt) ? rawBackgroundUrl : null;
  const showBackgroundImage = Boolean(resolvedBackgroundUrl);
  const vignetteOverlayStyle: CSSProperties | undefined = showBackgroundImage
    ? {
        backgroundImage: `radial-gradient(circle at 50% 32%, rgba(4, 6, 9, 0) 28%, rgba(4, 6, 9, 0.85) 100%), url("${GRAIN_TEXTURE_DATA_URL}")`,
        backgroundSize: "cover, 160px 160px",
        backgroundRepeat: "no-repeat, repeat",
        mixBlendMode: preferDarkMode ? "screen" : "multiply",
        opacity: preferDarkMode ? 0.55 : 0.45,
      }
    : undefined;

  if (resolvedMediaUrl && resolvedBackgroundUrl && resolvedMediaUrl === resolvedBackgroundUrl) {
    resolvedMediaUrl = null;
  }

  const layoutBase = "flex flex-col gap-12";
  const layoutClasses = withSidebarPlaceholder
    ? `${layoutBase} md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-12`
    : layoutBase;

  const breadcrumbColor = preferDarkMode ? "text-base-100" : "text-base-content/80";
  const paragraphColor = preferDarkMode ? "text-base-100" : "text-base-content/90";

  const content = (
    <div className={`relative w-full px-6 py-16 md:px-8 md:py-20 ${contentClassName}`.trim()}>
      <div className={layoutClasses}>
        <div className="space-y-6 md:max-w-[680px]">
          <nav
            className={`breadcrumbs text-sm ${breadcrumbColor} hidden md:block overflow-x-auto no-scrollbar`}
            aria-label="Breadcrumb"
          >
            <ul>
              {breadcrumbs.map((item, index) => (
                <li key={item} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                  {item}
                </li>
              ))}
            </ul>
          </nav>

          {resolvedMediaUrl ? (
            <div className="relative h-[260px] w-full overflow-hidden rounded-3xl bg-base-200">
              <Image
                src={resolvedMediaUrl}
                alt={mediaImageAlt ?? ""}
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <h1 className={`${preferDarkMode ? "heading-on-dark" : ""} hero-heading`.trim()}>
            {title}
          </h1>

          <div className={`space-y-4 text-lg leading-relaxed ${paragraphColor}`}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {callToAction ? (
            <div>
              <a className="btn btn-primary" href={callToAction.href}>
                {callToAction.label}
              </a>
            </div>
          ) : null}
        </div>

        {withSidebarPlaceholder ? <div className="hidden md:block" aria-hidden="true" /> : null}
      </div>
    </div>
  );

  const wrappedContent = useContainer ? (
    <div className="mx-auto flex w-full max-w-[var(--detail-content-max-width)] items-center">{content}</div>
  ) : (
    <div className="flex w-full items-center">{content}</div>
  );

  const fallbackBackgroundStyle = resolvedBackgroundUrl
    ? undefined
    : ({
        backgroundColor: "var(--color-primary)",
      } as const);

  return (
    <section
      className={`relative isolate flex min-h-[500px] items-center overflow-hidden bg-base-200 mb-[calc(var(--section-padding-y)*1.5)] md:mb-[var(--section-padding-y-xl)] ${
        preferDarkMode ? "text-base-100" : ""
      }`}
      style={fallbackBackgroundStyle}
    >
      {resolvedBackgroundUrl ? (
        <>
          <Image
            src={resolvedBackgroundUrl}
            alt={backgroundImageAlt ?? ""}
            fill
            priority
            className="absolute inset-0 -z-30 object-cover"
            sizes="100vw"
          />
          {vignetteOverlayStyle ? (
            <div
              className="absolute inset-0 -z-20 pointer-events-none"
              aria-hidden="true"
              style={vignetteOverlayStyle}
            />
          ) : null}
        </>
      ) : null}
      {preferDarkMode ? <div className="absolute inset-0 -z-10 bg-black/45" aria-hidden="true" /> : null}
      {wrappedContent}
    </section>
  );
}
