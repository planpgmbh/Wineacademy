import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPageHero } from "@/components/shared/DetailPageHero";
import { getCategoryDetail } from "@/lib/category-detail";

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

  const breadcrumbs = ["Seminare", category.title];

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

      <section id="category-content" className="mx-auto max-w-6xl px-6 py-16 md:px-8">
        <div className="space-y-4 text-base-content/80">
          <h2 className="text-3xl font-semibold text-base-content">Seminare entdecken</h2>
          <p>
            Hier entsteht die Übersicht der Seminare dieser Kategorie. Scrolle später erneut vorbei, um alle Inhalte zu sehen.
          </p>
        </div>
      </section>
    </>
  );
}
