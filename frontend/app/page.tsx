import LandingPage, { generateMetadata as generateLandingMetadata } from "./(landing)/[slug]/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return generateLandingMetadata({ params: Promise.resolve({ slug: "homepage" }) });
}

export default async function HomePage() {
  return LandingPage({ params: Promise.resolve({ slug: "homepage" }) });
}
