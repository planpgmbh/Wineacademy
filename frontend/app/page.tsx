import LandingPage, { generateMetadata as generateLandingMetadata, revalidate as landingRevalidate } from "./(landing)/[slug]/page";

export const revalidate = landingRevalidate;

export async function generateMetadata() {
  return generateLandingMetadata({ params: Promise.resolve({ slug: "homepage" }) });
}

export default async function HomePage() {
  return LandingPage({ params: Promise.resolve({ slug: "homepage" }) });
}
