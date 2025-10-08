import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "../../_components/landing/LandingPageRenderer";
import { fetchLandingPage } from "../../_lib/cms";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const landingPage = await fetchLandingPage(params.slug);
  if (!landingPage) {
    return {
      title: "Seite nicht gefunden",
    };
  }
  return {
    title: landingPage.titel,
  };
}

export default async function LandingPage({ params }: PageProps) {
  const landingPage = await fetchLandingPage(params.slug);
  if (!landingPage) {
    notFound();
  }
  return <LandingPageRenderer sections={landingPage.abschnitte ?? []} />;
}
