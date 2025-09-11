// Termin Lifecycles: setzt bei Erstellung fehlenden Preis auf Seminar.standardPreis

const toNumberOrUndefined = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

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

function formatDate(d: string | Date | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (!dt || isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Kurzformat für Titel: DD-MM-YY
function formatDateShort(d: string | Date | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (!dt || isNaN(dt.getTime())) return '';
  const yy = String(dt.getFullYear()).slice(-2);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}-${mm}-${yy}`;
}

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

const buildTageUebersicht = (data: any) => {
  try {
    const tage = Array.isArray(data.tage) ? data.tage : [];
    if (tage.length === 0) return undefined;
    const parts = tage.map((t: any) => {
      const d = formatDate(t?.datum);
      const von = (t?.startzeit || '').toString().slice(0, 5);
      const bis = (t?.endzeit || '').toString().slice(0, 5);
      return von && bis ? `${d} ${von}–${bis}` : d;
    });
    return parts.join(', ');
  } catch {
    return undefined;
  }
};

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
  // Titel/Tage-Übersicht generieren, falls leer
  if (!data.titel || String(data.titel).trim() === '') {
    const t = await buildTitel(data);
    if (t) data.titel = t;
  }
  const u = buildTageUebersicht(data);
  if (u) data.tageUebersicht = u;
};

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
  // Titel/Tage-Übersicht bei Änderungen ggf. neu setzen
  if (!data.titel || String(data.titel).trim() === '') {
    const t = await buildTitel(data);
    if (t) data.titel = t;
  }
  const u = buildTageUebersicht(data);
  if (u) data.tageUebersicht = u;
};

export default {
  beforeCreate,
  beforeUpdate,
};
