import { LandingPageRenderer } from "./_components/landing/LandingPageRenderer";
import { fetchLandingPage } from "./_lib/cms";

export default async function Home() {
  const landingPage = await fetchLandingPage("homepage");
  return <LandingPageRenderer sections={landingPage?.abschnitte ?? []} />;
}
