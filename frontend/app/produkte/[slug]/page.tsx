import { notFound } from "next/navigation";

import { ProductBookingCard } from "@/components/product/ProductBookingCard";
import { ProductBookingMobile } from "@/components/product/ProductBookingMobile";
import { ProductContentTabs } from "@/components/product/ProductContentTabs";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { getProductDetail } from "@/lib/product-detail";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);

  if (!product) {
    notFound();
  }

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Produkte", href: "/produkte" },
    { label: product.title }
  ];

  const bookingCardProps = {
    highlightLabel: product.bookingBox.highlightLabel ?? undefined,
    title: product.bookingBox.überschrift,
    price: product.price,
    description: product.bookingBox.beschreibung,
    buttonText: product.bookingBox.buttonText,
    productSlug: product.slug,
    productTitle: product.title,
    priceValue: product.priceValue,
    priceNetto: product.priceNetto,
    steuerSatz: product.steuerSatz,
    priceFormatted: product.price,
    isVoucher: product.isVoucher
  } as const;

  return (
    <>
      <DesktopBookingOverlay footerId="site-footer">
        <ProductBookingCard {...bookingCardProps} className="w-full" />
      </DesktopBookingOverlay>

      <DetailPageHero
        title={product.hero.title}
        paragraphs={product.hero.paragraphs}
        breadcrumbs={breadcrumbs}
        backgroundImageUrl={product.hero.backgroundImageUrl}
        backgroundImageAlt={product.hero.backgroundImageAlt ?? undefined}
        mediaImageUrl={product.mainImage?.url ?? undefined}
        mediaImageAlt={product.mainImage?.alt ?? undefined}
      />

      {product.tabs.length > 0 ? (
        <div className="relative">
          <div className="mx-auto max-w-[var(--detail-content-max-width)] px-6 md:px-8">
            <div className="mt-12 space-y-10 md:mt-16 md:pr-[420px]">
              <ProductContentTabs tabs={product.tabs} />
            </div>
          </div>
        </div>
      ) : null}

      <ProductBookingMobile {...bookingCardProps} />
    </>
  );
}
