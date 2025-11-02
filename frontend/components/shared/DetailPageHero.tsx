import Image from "next/image";

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
    if (lowerUrl.includes("favicon")) {
      return true;
    }
    const altText = alt?.toLowerCase() ?? "";
    if (altText.includes("platzhalter") || altText.includes("placeholder")) {
      return true;
    }
    return false;
  };

  const rawMediaUrl = sanitiseUrl(mediaImageUrl);
  const rawBackgroundUrl = sanitiseUrl(backgroundImageUrl);

  let resolvedMediaUrl = rawMediaUrl && !isPlaceholder(rawMediaUrl, mediaImageAlt) ? rawMediaUrl : null;
  const resolvedBackgroundUrl = rawBackgroundUrl ?? null;

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
          <nav className={`breadcrumbs text-sm ${breadcrumbColor}`} aria-label="Breadcrumb">
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

          <h1 className={preferDarkMode ? "heading-on-dark" : undefined}>
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
    <div className="mx-auto flex w-full max-w-6xl items-center">{content}</div>
  ) : (
    <div className="flex w-full items-center">{content}</div>
  );

  return (
    <section
      className={`relative isolate flex min-h-[500px] items-center overflow-hidden bg-base-200 ${
        preferDarkMode ? "text-base-100" : ""
      }`}
    >
      {resolvedBackgroundUrl ? (
        <Image
          src={resolvedBackgroundUrl}
          alt={backgroundImageAlt ?? ""}
          fill
          priority
          className="absolute inset-0 -z-20 object-cover"
          sizes="100vw"
        />
      ) : null}
      {preferDarkMode ? <div className="absolute inset-0 -z-10 bg-black/45" aria-hidden="true" /> : null}
      {wrappedContent}
    </section>
  );
}
