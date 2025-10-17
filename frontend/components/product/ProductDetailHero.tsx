import Image from "next/image";
import { serifBabe } from "@/app/fonts";

type ProductDetailHeroProps = {
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
};

export function ProductDetailHero({
  title,
  paragraphs,
  breadcrumbs,
  contentClassName = "",
  useContainer = true,
  withSidebarPlaceholder = true,
  backgroundImageUrl,
  backgroundImageAlt,
  mediaImageUrl,
  mediaImageAlt
}: ProductDetailHeroProps) {
  const layoutBase = "flex min-h-[500px] flex-col justify-center gap-12";
  const layoutClasses = withSidebarPlaceholder
    ? `${layoutBase} md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-12`
    : layoutBase;

  const content = (
    <div className={`relative px-6 py-16 md:px-8 md:py-20 ${contentClassName}`.trim()}>
      <div className={layoutClasses}>
        <div className="space-y-6 md:max-w-none">
          <nav className="breadcrumbs text-sm text-base-content/80" aria-label="Breadcrumb">
            <ul>
              {breadcrumbs.map((item, index) => (
                <li key={item} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                  {item}
                </li>
              ))}
            </ul>
          </nav>

          {mediaImageUrl ? (
            <div className="relative h-[260px] w-full overflow-hidden rounded-3xl bg-base-200">
              <Image
                src={mediaImageUrl}
                alt={mediaImageAlt ?? ""}
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <h1 className={`${serifBabe.className} text-5xl font-light leading-tight text-base-content`}>
            {title}
          </h1>

          <div className="space-y-4 text-lg leading-relaxed text-base-content/90">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        {withSidebarPlaceholder ? <div className="hidden md:block" aria-hidden="true" /> : null}
      </div>
    </div>
  );

  const imageSrc = backgroundImageUrl ?? "/img/product_detail.jpg";
  const imageAlt = backgroundImageAlt ?? "";

  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        className="absolute inset-0 -z-10 object-cover"
        sizes="100vw"
      />

      {useContainer ? <div className="mx-auto max-w-6xl">{content}</div> : content}
    </section>
  );
}
