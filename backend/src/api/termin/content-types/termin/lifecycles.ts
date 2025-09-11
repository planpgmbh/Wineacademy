// Termin-Lifecycles
// Zweck: Serverseitige Vorbelegung/Ableitung von Feldern beim Erstellen/Aktualisieren von Terminen.
//
// Was wird gemacht?
// - Preis-Default: Wenn kein Preis gesetzt ist, wird er aus dem verknüpften Seminar (standardPreis) übernommen.
// - Titel-Autogenerierung: Wenn kein sinnvoller Titel vorhanden ist (leer/"Untitled"),
//   wird er als "DDMMYY | <Seminarname> | <Ort>" erzeugt (Datum aus dem ersten Eintrag in tage[]).
//
// Hinweis zu Performance: Die Titel-Generierung macht schlanke DB-Looks (Seminarname/Ort-Name).
// Das ist für Einzeloperationen sinnvoll und gut verständlich. Für Massenimporte könnte
// man alternativ in Services bündeln.

const toNumberOrUndefined = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Extrahiert eine numerische ID aus unterschiedlichen Relationen-Formaten, wie sie
// vom Content-Manager oder der API kommen können:
// - direkte Zahl (42)
// - Objekt mit connect: 42 bzw. connect: [42]
// - Objekt mit id: 42
const extractId = (rel: any): number | undefined => {
  if (rel == null) return undefined;
  if (typeof rel === 'number') return rel;
  if (typeof rel === 'object') {
    const c = (rel as any).connect;
    if (typeof c === 'number') return c;
    if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'number') return c[0];
    if (typeof (rel as any).id === 'number') return (rel as any).id;
  }
  return undefined;
};

// Normalformat (Reserve-Helfer): YYYY-MM-DD
function formatDate(d: string | Date | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (!dt || isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Kurzformat (für Titel): DDMMYY
function formatDateShort(d: string | Date | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (!dt || isNaN(dt.getTime())) return '';
  const yy = String(dt.getFullYear()).slice(-2);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

// Beurteilt, ob ein Titel fehlt oder bedeutungslos ist (z. B. "Untitled").
const isMissingTitle = (v: any) => {
  if (v == null) return true;
  const s = String(v).trim();
  if (s === '') return true;
  return /^untitled$/i.test(s);
};

// Baut den Titel "DDMMYY | <Seminarname> | <Ort>"
// - Datum: erstes Element aus tage[] (tages.datum)
// - Seminarname/Ort: werden über schlanke DB-Queries gelesen
const buildTitel = async (data: any) => {
  try {
    const tage = Array.isArray(data.tage) ? data.tage : [];
    const first = tage[0];
    const dateStr = formatDateShort(first?.datum);
    const seminarId = extractId(data.seminar);
    const ortId = extractId(data.ort);
    let seminarName: string | undefined = undefined;
    let ortName: string | undefined = undefined;
    if (seminarId) {
      const s = await (strapi as any).db.query('api::seminar.seminar').findOne({ where: { id: seminarId }, select: ['seminarname'] });
      seminarName = s?.seminarname;
    }
    if (ortId) {
      const o = await (strapi as any).db.query('api::ort.ort').findOne({ where: { id: ortId }, select: ['standort'] });
      ortName = o?.standort;
    }
    const parts = [dateStr, seminarName, ortName].filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');
  } catch {}
  return undefined;
};

// (Entfernt) Früher: buildTageUebersicht – wurde nicht persistiert/genutzt; daher entfernt.

// Vor Anlage eines Termins:
// - Preis aus Seminar übernehmen, wenn nicht gesetzt
// - Titel generieren, wenn leer/"Untitled"
// - Tage-Übersicht erzeugen
const beforeCreate = async (event: any) => {
  const { data } = event.params;
  // Wenn kein Preis gesetzt ist, Standardpreis des verknüpften Seminars kopieren
  const hasPreis = data.preis != null && data.preis !== '';
  const seminarId = extractId(data.seminar);
  if (!hasPreis && seminarId) {
    const sem = await (strapi as any).db
      .query('api::seminar.seminar')
      .findOne({ where: { id: seminarId }, select: ['standardPreis'] });
    const std = toNumberOrUndefined(sem?.standardPreis);
    if (std != null) data.preis = std;
  }
  // Titel generieren, falls leer
  if (isMissingTitle(data.titel)) {
    const t = await buildTitel(data);
    if (t) data.titel = t;
  }
};

// Vor Aktualisierung eines Termins:
// - Wenn Preis explizit geleert wird, erneut Standardpreis übernehmen
// - Titel ggf. neu generieren (nur, wenn (weiterhin) leer/"Untitled")
// - Tage-Übersicht aktualisieren
const beforeUpdate = async (event: any) => {
  const { data, where } = event.params;
  // Nur falls explizit leer gesetzt wird und Seminar vorhanden ist
  const willBeLeer = data.preis === null || data.preis === '' || data.preis === undefined;
  const seminarId = extractId(data.seminar);
  if (willBeLeer && seminarId) {
    const sem = await (strapi as any).db.query('api::seminar.seminar').findOne({ where: { id: seminarId }, select: ['standardPreis'] });
    const std = toNumberOrUndefined(sem?.standardPreis);
    if (std != null) data.preis = std;
  }
  // Titel bei Änderungen ggf. neu setzen
  if (isMissingTitle(data.titel)) {
    const t = await buildTitel(data);
    if (t) data.titel = t;
  }
};

export default {
  beforeCreate,
  beforeUpdate,
};
