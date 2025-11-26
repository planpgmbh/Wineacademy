import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { DesktopBookingOverlay } from "@/components/shared/DesktopBookingOverlay";
import { ProductContentTabs } from "@/components/product/ProductContentTabs";
import { VoucherBookingCard } from "@/components/voucher/VoucherBookingCard";
import { VoucherBookingMobile } from "@/components/voucher/VoucherBookingMobile";
import { getVoucherDetail } from "@/lib/voucher-detail";

export default async function VoucherDetailPage() {
  const voucher = await getVoucherDetail();

  const breadcrumbs = ["Gutscheine", voucher.title];

  const bookingProps = {
    highlightLabel: voucher.bookingBox.highlightLabel ?? undefined,
    title: voucher.bookingBox.überschrift,
    description: voucher.bookingBox.beschreibung,
    buttonText: voucher.bookingBox.buttonText,
    defaultAmount: voucher.bookingBox.defaultAmount,
    minAmount: voucher.bookingBox.minAmount ?? null,
    maxAmount: voucher.bookingBox.maxAmount ?? null,
    voucherTitle: voucher.title,
    voucherDescription: voucher.hero.paragraphs[0] ?? voucher.bookingBox.beschreibung,
    imageUrl: voucher.mainImage?.url ?? null,
    imageAlt: voucher.mainImage?.alt ?? null,
    shippingCost: voucher.shippingCost ?? null
  } as const;

  return (
    <>
      <DesktopBookingOverlay footerId="site-footer">
        <VoucherBookingCard {...bookingProps} className="w-full" />
      </DesktopBookingOverlay>

      <DetailPageHero
        title={voucher.hero.title}
        paragraphs={voucher.hero.paragraphs}
        breadcrumbs={breadcrumbs}
        backgroundImageUrl={voucher.hero.backgroundImageUrl}
        backgroundImageAlt={voucher.hero.backgroundImageAlt ?? undefined}
        mediaImageUrl={voucher.mainImage?.url ?? undefined}
        mediaImageAlt={voucher.mainImage?.alt ?? undefined}
        preferDarkMode={voucher.hero.preferDarkMode}
      />

      {voucher.tabs.length > 0 ? (
        <div className="relative">
          <div className="mx-auto max-w-[var(--detail-content-max-width)] px-6 md:px-8">
            <div className="mt-12 space-y-10 md:mt-16 md:pr-[420px]">
              <ProductContentTabs tabs={voucher.tabs} />
            </div>
          </div>
        </div>
      ) : null}

      <VoucherBookingMobile {...bookingProps} />
    </>
  );
}
