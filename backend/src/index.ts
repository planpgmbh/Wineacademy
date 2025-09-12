// import type { Core } from '@strapi/strapi';

type UID = 'api::kategorie.kategorie' | 'api::ort.ort' | 'api::seminar.seminar' | 'api::gutschein.gutschein';

function toBool(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function upsertCategory(strapi: any, titel: string, beschreibung?: string) {
  const existing = await strapi.db.query('api::kategorie.kategorie').findOne({ where: { titel }, select: ['id'] });
  if (existing) {
    await strapi.entityService.update('api::kategorie.kategorie', existing.id, {
      data: { beschreibung: beschreibung ?? undefined, publishedAt: nowIso() },
    });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::kategorie.kategorie', {
    data: { titel, beschreibung: beschreibung ?? undefined, publishedAt: nowIso() },
  });
  return created.id as number;
}

async function upsertOrt(
  strapi: any,
  values: { standort: string; typ: 'vorort' | 'online'; veranstaltungsort?: string; strasse?: string; plz?: string; stadt?: string; land?: 'Deutschland' }
) {
  const existing = await strapi.db.query('api::ort.ort').findOne({ where: { standort: values.standort }, select: ['id'] });
  const data = { ...values, publishedAt: nowIso() } as any;
  if (existing) {
    await strapi.entityService.update('api::ort.ort', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::ort.ort', { data });
  return created.id as number;
}

async function upsertSeminar(
  strapi: any,
  values: {
    seminarname: string;
    slug?: string;
    kurzbeschreibung?: string;
    beschreibung?: string;
    infos?: string;
    standardPreis?: number;
    mitMwst?: boolean;
    standardKapazitaetProTermin?: number;
    aktiv?: boolean;
    kategorien?: number[];
  }
) {
  const existing = await strapi.db.query('api::seminar.seminar').findOne({ where: { seminarname: values.seminarname }, select: ['id', 'slug'] });
  const data: any = {
    ...values,
    slug: values.slug ? slugify(values.slug) : slugify(values.seminarname),
    publishedAt: nowIso(),
  };
  if (values.kategorien && values.kategorien.length > 0) {
    data.kategorien = { set: values.kategorien.map((id) => id) };
  }
  if (existing) {
    await strapi.entityService.update('api::seminar.seminar', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::seminar.seminar', { data });
  return created.id as number;
}

async function upsertGutschein(
  strapi: any,
  values: { code: string; typ: 'betrag' | 'prozent'; wert: number; aktiv?: boolean; maxNutzung?: number; bemerkung?: string; gueltigAb?: string; gueltigBis?: string }
) {
  const code = values.code.trim();
  const existing = await strapi.db.query('api::gutschein.gutschein').findOne({ where: { code }, select: ['id'] });
  const data: any = { ...values, code };
  if (existing) {
    await strapi.entityService.update('api::gutschein.gutschein', existing.id, { data });
    return existing.id as number;
  }
  const created = await strapi.entityService.create('api::gutschein.gutschein', { data });
  return created.id as number;
}

async function runSeed(strapi: any) {
  const log = (msg: string) => strapi.log.info(`[seed] ${msg}`);
  log('Starte Seeding (ohne Termine)');

  // Hilfsfunktionen für Scraping
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const decodeHtml = (s: string) =>
    s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&euro;/g, '€')
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&#[0-9]+;/g, (m) => {
        const code = Number(m.replace(/[^0-9]/g, ''));
        try {
          return String.fromCharCode(code);
        } catch {
          return '';
        }
      })
      .trim();
  const stripTags = (html: string) => decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

  async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WineAcademySeeder/1.0)' } as any });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.text();
  }

  function findAll(regex: RegExp, input: string): RegExpExecArray[] {
    const results: RegExpExecArray[] = [];
    const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(input))) results.push(m);
    return results;
  }

  function mapCategoryName(raw?: string): string[] {
    const list: string[] = [];
    const s = (raw || '').toLowerCase();
    if (s.includes('wset')) list.push('WSET');
    if (s.includes('sommelier')) list.push('Sommelier Ausbildung');
    if (s.includes('masterclass')) list.push('Masterclass');
    if (s.includes('tasting') || s.includes('verkostung')) list.push('Tastings');
    if (s.includes('bourgogne')) list.push('Bourgogne');
    if (s.includes('sensorik')) list.push('Sensorik');
    return Array.from(new Set(list));
  }

  type ShopItem = {
    title: string;
    url: string;
    price?: number; // Brutto in EUR
    category?: string;
  };

  async function collectShopItems(): Promise<ShopItem[]> {
    const pages: string[] = ['https://www.wineacademy.de/shop/'];
    for (let i = 2; i <= 8; i++) pages.push(`https://www.wineacademy.de/shop/page/${i}/`);
    const items: Record<string, ShopItem> = {};
    for (const url of pages) {
      try {
        const html = await fetchText(url);
        // WooCommerce Tracking Data auf Listing („span.gtm4wp_productdata ... data-gtm4wp_product_data=…“)
        const spans = findAll(/<span[^>]*class=\"gtm4wp_productdata\"[^>]*data-gtm4wp_product_data=\"([^\"]+)\"/g, html);
        for (const m of spans) {
          const raw = decodeHtml(m[1]);
          try {
            const j = JSON.parse(raw);
            const productUrl: string | undefined = j.productlink || j.item_url;
            const title: string = j.item_name || '';
            const price: number | undefined = typeof j.price === 'number' ? j.price : undefined;
            const category: string | undefined = j.item_category || undefined;
            if (!productUrl || !title) continue;
            // Ausschlüsse: Gutscheine
            if ((category || '').toLowerCase().includes('gutschein')) continue;
            items[productUrl] = { title, url: productUrl, price, category };
          } catch {}
        }
      } catch (err) {
        strapi.log.warn(`[seed] Shop-Seite nicht abrufbar: ${url} (${(err as any)?.message})`);
      }
      await sleep(150);
    }
    return Object.values(items);
  }

  async function enrichFromDetail(item: ShopItem): Promise<ShopItem & { short?: string; desc?: string; breadcrumbs?: string[] }> {
    try {
      const html = await fetchText(item.url);
      const h1m = /<h1[^>]*class=\"product_title[^\"]*\"[^>]*>([\s\S]*?)<\/h1>/m.exec(html);
      const title = h1m ? stripTags(h1m[1]) : item.title;
      const shortM = /<div[^>]*class=\"woocommerce-product-details__short-description\"[^>]*>([\s\S]*?)<\/div>/m.exec(html);
      const descM = /<div[^>]*id=\"tab-description\"[^>]*>([\s\S]*?)<\/div>/m.exec(html);
      const priceHidden = /name=\"gtm4wp_product_data\"[^>]*value=\"([^\"]+)\"/m.exec(html);
      if (priceHidden) {
        try {
          const j = JSON.parse(decodeHtml(priceHidden[1]));
          if (typeof j.price === 'number') item.price = j.price;
          if (typeof j.item_category === 'string') item.category = j.item_category;
        } catch {}
      }
      const bc = findAll(/<span class=\"woocommerce-breadcrumb-item\">(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/span>/g, html).map((m) => stripTags(m[1]));
      return { ...item, title, short: shortM ? stripTags(shortM[1]) : undefined, desc: descM ? stripTags(descM[1]) : undefined, breadcrumbs: bc };
    } catch (err) {
      strapi.log.warn(`[seed] Detail nicht abrufbar: ${item.url}`);
      return { ...item } as any;
    }
  }

  const catTexts: Record<string, string> = {
    Bourgogne:
      'Über 2000 Jahre Weinbaugeschichte, ein einzigartiges Terroir und unvergleichlicher Savoir-Faire der Winzer. Mit 84 Appellationen, zahlreichen kleinen Erzeugern, kleinteiligen Parzellen, Climats und einem einzigartigen Zusammenspiel zwischen Terroir und Rebsorten bietet die Region ein unvergleichliches Entdeckungspotential. Entdecke die Exzellenz der Bourgogne in unserer exklusiven Kursreihe bei der Wine Academy Hamburg. Tauche ein in die Welt dieser renommierten Weinregion und gewinne ein fundiertes Verständnis für ihre Geschichte, Terroirs und Weinherstellungstechniken. Unsere Kurse bieten einzigartige Einblicke in die Vielfalt und Finesse von Chardonnay und Pinot Noir sowie in die Unterschiede der bedeutendsten Crus. Werden Sie ein Experte für Bourgogne-Weine und erleben Sie unvergleichliche Geschmackserlebnisse auf höchstem Niveau.',
    Masterclass:
      'Für (angehende) Sommeliers, WSET-Studenten und Weinliebhaber. Unsere Masterclasses und Tageskurse bieten einen tiefgehenden Einblick in verschieden Regionen, Weine und Sake. Vormittags oder Abends, unter der Woche und am Wochenende, einige Stunden bis hin zu einem ganzen Tag – unsere Masterclasses lassen sich auch in einen vollen Alltag integrieren. Werde Teil unserer Community von Weinliebhabern und Fachleuten und vertiefe Dein Wissen unter der Anleitung von erfahrenen Experten. Entdecke auch unsere Prüfungsvorbereitungskurse für WSET und IHK Sommelier und genieße eine einzigartige Lernerfahrung in unserer Weinschule.',
    Sensorik:
      'Entdecke die verborgenen Nuancen des Weins und werde zum Sensorik-Experten in unserer Weinschule. In unseren Masterclasses zur Wein Sensorik erkunden wir die Welt unserer Sinneswahrnehmung. Von Einsteigern bis zum Profi – wir helfen Euch gerne das passende Level zu finden. Auch das spannende Thema der Weinfehler, sie zu erkennen und zu beschreiben ist Teil des Kursangebots. Tauche ein in die Grundlagen der menschlichen Sinneswahrnehmung und schärfe deine Sinne, um subtile Aromen in Weinen besser wahrzunehmen. Ein unverzichtbarer Kurs für alle Weinliebhaber und Fachleute, die ihr Sensorik-Wissen vertiefen möchten. Wenn Du bereits Erfahrung im Verkosten hast, bist Du bei unserem Sensorik Kurs für Fortgeschrittene und Weinfehler für Professionals richtig. Bist du bereit, die Herausforderung anzunehmen und Deine Sinne bei einer Blindverkostung auf die Probe zu stellen?',
    'Sommelier Ausbildung':
      'Die IHK-geprüfte Sommelier-Ausbildung vermittelt fundiertes Wissen zu Weinbau, Herstellung, Geschichte und Food-Pairing sowie professionelle Verkostungs- und Servicekompetenz. Sie bereitet auf Spitzenleistungen in Gastronomie, Handel und Weingütern vor; ergänzt durch Workshops und Exkursionen.',
    WSET:
      'Der Wine & Spirit Education Trust (WSET®) entwickelt international anerkannte Qualifikationen in Wein, Spirituosen (und Sake). Seit 1969 einer der weltweit führenden Anbieter: An der Wine Academy Hamburg kannst du WSET Level 1–3 Weine absolvieren – mit strukturierter Verkostung und Abschlusszertifikat.',
    Tastings:
      'Weintastings & Seminare in Hamburg: Theorie plus Praxis mit einer sorgfältig kuratierten Auswahl an Weinen aus verschiedenen Regionen und Stilistiken. Ideal, um sensorische Fähigkeiten zu entwickeln, Wissen zu vertiefen und aktuelle Themen in Workshops (z. B. Blindverkostung, Prüfungsvorbereitung) zu erleben.',
  };

  const catIds: Record<string, number> = {};
  for (const [titel, beschreibung] of Object.entries(catTexts)) {
    catIds[titel] = await upsertCategory(strapi, titel, beschreibung);
  }
  log(`Kategorien: ${Object.keys(catIds).join(', ')}`);

  const hamburgId = await upsertOrt(strapi, {
    standort: 'Hamburg',
    typ: 'vorort',
    veranstaltungsort: 'Wine Academy Hamburg',
    stadt: 'Hamburg',
    land: 'Deutschland',
  });
  const mannheimId = await upsertOrt(strapi, {
    standort: 'Mannheim',
    typ: 'vorort',
    veranstaltungsort: 'Wine Academy Mannheim',
    stadt: 'Mannheim',
    land: 'Deutschland',
  });
  const onlineId = await upsertOrt(strapi, {
    standort: 'Online',
    typ: 'online',
    veranstaltungsort: 'Online via Zoom',
    stadt: 'Remote',
    land: 'Deutschland',
  });
  log(`Orte IDs: Hamburg=${hamburgId}, Mannheim=${mannheimId}, Online=${onlineId}`);

  // Dynamische Seminare aus dem Live-Shop scrapen und anlegen
  const wsetCatId = catIds['WSET'];
  const sensorikCatId = catIds['Sensorik'];
  const masterclassCatId = catIds['Masterclass'];
  const sommelierCatId = catIds['Sommelier Ausbildung'];
  const tastingsCatId = catIds['Tastings'];
  const bourgogneCatId = catIds['Bourgogne'];

  const categoryIdByName: Record<string, number> = {
    WSET: wsetCatId,
    Sensorik: sensorikCatId,
    Masterclass: masterclassCatId,
    'Sommelier Ausbildung': sommelierCatId,
    Tastings: tastingsCatId,
    Bourgogne: bourgogneCatId,
  };

  const shopItems = await collectShopItems();
  log(`Gefundene Shop-Items (gefiltert): ${shopItems.length}`);
  for (const it of shopItems) {
    const d = await enrichFromDetail(it);
    const slug = (() => {
      try {
        const u = new URL(d.url);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || slugify(d.title);
      } catch {
        return slugify(d.title);
      }
    })();
    const categoryNames = [
      ...mapCategoryName(d.category),
      ...(d.breadcrumbs || []).map((x) => mapCategoryName(x)).flat(),
    ];
    const catIdsToSet = Array.from(new Set(categoryNames))
      .map((name) => categoryIdByName[name])
      .filter(Boolean) as number[];

    // Fallback-Kurzbeschreibung: nutze ggf. ersten Satz der langen Beschreibung
    const kurz = d.short || (d.desc ? (d.desc.split('.').slice(0, 2).join('. ').trim() || undefined) : undefined);
    const infos = `Quelle: ${d.url}${d.category ? `\nKategorie: ${d.category}` : ''}`;

    try {
      await upsertSeminar(strapi, {
        seminarname: d.title,
        slug,
        kurzbeschreibung: kurz,
        beschreibung: d.desc,
        infos,
        standardPreis: typeof d.price === 'number' ? Number(d.price) : 0,
        mitMwst: true,
        standardKapazitaetProTermin: 20,
        aktiv: true,
        kategorien: catIdsToSet.length ? catIdsToSet : undefined,
      });
      log(`Seminar upserted: ${d.title} [${slug}] (${catIdsToSet.join(',') || 'ohne Kategorien'})`);
    } catch (e) {
      strapi.log.error(
        `[seed] Upsert fehlgeschlagen: ${d.title} [${slug}] – Kategorien: ${catIdsToSet.join(',') || 'none'} – Fehler: ${(e as any)?.message}`
      );
    }
    await sleep(80);
  }

  await upsertGutschein(strapi, { code: 'WELCOME10', typ: 'prozent', wert: 10, aktiv: true, maxNutzung: 999, bemerkung: '10 % Willkommensrabatt' });
  await upsertGutschein(strapi, { code: 'TEST-25', typ: 'betrag', wert: 25, aktiv: true, maxNutzung: 10, bemerkung: '25 € Testgutschein' });
  await upsertGutschein(strapi, { code: 'WSET50', typ: 'betrag', wert: 50, aktiv: true, maxNutzung: 100, bemerkung: '50 € Gutschein (WSET-Thema – aktuell keine inhaltliche Einschränkung)' });

  log('Seeding abgeschlossen');
}

export default {
  register() {},
  async bootstrap({ strapi }: any) {
    const shouldSeed = toBool(process.env.SEED_ON_BOOT);
    if (!shouldSeed) return;
    try {
      await runSeed(strapi);
    } catch (err) {
      strapi.log.error('[seed] Fehler', err);
    }
  },
};
