// Einfache Logik: Wenn der Titel leer ist, setze ihn auf das früheste "datum" aus den "tage"-Komponenten
const setTitelIfEmpty = async (id: number) => {
  if (!id) return;
  const rec = await strapi.db.query('api::termin.termin').findOne({
    where: { id },
    populate: { tage: true, seminar: true, ort: true },
  });
  const current = (rec as any)?.titel as string | undefined;
  if (current && String(current).trim() !== '') return;

  const tage = Array.isArray((rec as any)?.tage) ? (rec as any).tage : [];
  if (!tage.length) return;

  const norm = tage
    .filter(Boolean)
    .map((t: any) => ({ datum: t?.datum, startzeit: (t?.startzeit || '00:00:00').slice(0, 8) }))
    .filter((t: any) => t.datum);
  if (!norm.length) return;
  norm.sort((a: any, b: any) => (a.datum + 'T' + a.startzeit).localeCompare(b.datum + 'T' + b.startzeit));
  const firstDate = norm[0].datum as string;
  if (!firstDate) return;

  // Datum von YYYY-MM-DD in YYYY-DD-MM umstellen
  const [y, m, d] = firstDate.split('-');
  const ydm = [y, d, m].filter(Boolean).join('-');

  const seminarName = (rec as any)?.seminar?.seminarname as string | undefined;
  const ort = (rec as any)?.ort as any | undefined;
  const ortName = (ort?.standort || ort?.veranstaltungsort || ort?.stadt) as string | undefined;

  const parts = [ydm, seminarName, ortName].filter((v) => v && String(v).trim() !== '');
  const titel = parts.join(' – ');

  await strapi.db.query('api::termin.termin').update({ where: { id }, data: { titel } });
};

const lifecycles = {
  async afterCreate(event: any) {
    const id = event?.result?.id as number | undefined;
    if (id) await setTitelIfEmpty(id);
  },
  async afterUpdate(event: any) {
    const id = (event?.result?.id as number | undefined) || (event?.params?.where as any)?.id;
    if (id) await setTitelIfEmpty(id);
  },
};

export default lifecycles;
