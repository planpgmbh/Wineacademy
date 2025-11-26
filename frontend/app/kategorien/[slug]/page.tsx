import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { SeminarFinder } from "@/components/seminar/SeminarFinder";
import { getCategoryDetail } from "@/lib/category-detail";
import { getSeminarFinderData } from "@/lib/seminar-finder";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryDetail(slug);

  if (!category) {
    return {};
  }

  const title = category.seoTitle ?? category.title;
  const description = category.seoDescription ?? category.description;

  return {
    title,
    description: description.length > 0 ? description : undefined,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryDetail(slug);

  if (!category) {
    notFound();
  }

  const seminarFinderData = await getSeminarFinderData();

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Seminare", href: "/seminare" },
    { label: category.title }
  ];

  return (
    <>
      <DetailPageHero
        title={category.title}
        paragraphs={category.paragraphs}
        breadcrumbs={breadcrumbs}
        backgroundImageUrl={category.backgroundImageUrl}
        backgroundImageAlt={category.backgroundImageAlt ?? undefined}
        withSidebarPlaceholder={false}
        callToAction={{ label: "Seminare finden", href: "#category-content" }}
        preferDarkMode={category.heroDarkMode}
      />

      <SeminarFinder
        id="category-content"
        überschrift="Finde dein passendes Seminar"
        überschriftStufe="h2"
        categories={seminarFinderData.categories}
        locations={seminarFinderData.locations}
        initialCategorySlug={category.slug}
      />
    </>
  );
}
