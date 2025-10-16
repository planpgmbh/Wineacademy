export type NavigationLink = {
  title: string;
  href: string | null;
  target: "_self" | "_blank";
};

export type NavigationItem = NavigationLink & {
  subItems: NavigationLink[];
};

const DEFAULT_NAVIGATION: NavigationItem[] = [
  {
    title: "Wine Academy",
    href: "/wine-academy",
    target: "_self",
    subItems: [
      { title: "Wine Academy", href: "/wine-academy", target: "_self" },
      { title: "Studio", href: "/wine-academy/studio", target: "_self" },
      { title: "Team", href: "/wine-academy/team", target: "_self" },
      { title: "Unsere Philosophie", href: "/wine-academy/philosophie", target: "_self" },
    ],
  },
  {
    title: "Ausbildung",
    href: "/ausbildung",
    target: "_self",
    subItems: [
      { title: "Sommeliere", href: "/ausbildung/sommeliere", target: "_self" },
      { title: "WSET", href: "/ausbildung/wset", target: "_self" },
    ],
  },
  {
    title: "Kurse",
    href: "/kurse",
    target: "_self",
    subItems: [
      { title: "Masterclasses", href: "/kurse/masterclasses", target: "_self" },
      { title: "Weinkurse", href: "/kurse/weinkurse", target: "_self" },
    ],
  },
  { title: "Events", href: "/events", target: "_self", subItems: [] },
  { title: "Gutscheine", href: "/gutscheine", target: "_self", subItems: [] },
  { title: "Kontakt", href: "/kontakt", target: "_self", subItems: [] },
];

type NavigationResponse = {
  items?: unknown;
};

function normaliseLink(entry: any): NavigationLink {
  return {
    title: typeof entry?.titel === "string" ? entry.titel : "",
    href: typeof entry?.link === "string" && entry.link.length > 0 ? entry.link : null,
    target: entry?.ziel === "_blank" ? "_blank" : "_self",
  };
}

function normaliseItems(rawItems: any): NavigationItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map((item) => {
    const subItemsRaw = Array.isArray(item?.unterpunkte) ? item.unterpunkte : [];
    return {
      ...normaliseLink(item),
      subItems: subItemsRaw.map(normaliseLink),
    };
  });
}

function getApiBaseUrl() {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  return base ? base.replace(/\/$/, "") : null;
}

export async function getNavigation(): Promise<NavigationItem[]> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    console.warn("[navigation] Kein API-Basis-URL konfiguriert (API_INTERNAL_URL oder NEXT_PUBLIC_API_URL).");
    return DEFAULT_NAVIGATION;
  }

  try {
    const response = await fetch(`${baseUrl}/api/public/navigation`, {
      next: { revalidate: 60 },
      cache: "force-cache",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[navigation] Fetch fehlgeschlagen (${response.status}) – Navigation wird leer gerendert.`);
      return [];
    }

    const data = (await response.json()) as NavigationResponse;
    const items = normaliseItems((data as any)?.items);
    return items.length > 0 ? items : DEFAULT_NAVIGATION;
  } catch (error) {
    console.error("[navigation] Fehler beim Laden der Navigation:", error);
    return DEFAULT_NAVIGATION;
  }
}
