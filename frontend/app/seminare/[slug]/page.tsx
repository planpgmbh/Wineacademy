import { getSeminar } from '@/lib/api';

type Props = { params: { slug: string } };

export default async function SeminarDetailPage({ params }: Props) {
  const seminar = await getSeminar(params.slug);
  const termine = seminar.termine || [];
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{seminar.seminarname}</h1>
        {seminar.kurzbeschreibung && (
          <p className="text-gray-700 mt-1">{seminar.kurzbeschreibung}</p>
        )}
      </div>

      {seminar.beschreibung && (
        <article className="prose max-w-none">
          <div dangerouslySetInnerHTML={{ __html: seminar.beschreibung }} />
        </article>
      )}

      <section>
        <h2 className="text-xl font-medium mb-2">Termine</h2>
        {termine.length === 0 && <p>Keine Termine verfügbar.</p>}
        <ul className="space-y-3">
          {termine.map((t) => (
            <li key={t.id} className="border rounded p-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <span>Status: {t.planungsstatus}</span>
                {typeof t.preis !== 'undefined' && <span>Preis: {t.preis} €</span>}
                {typeof t.kapazitaet !== 'undefined' && (
                  <span>Kapazität: {t.kapazitaet}</span>
                )}
              </div>
              <div className="mt-2 text-gray-700">
                {t.tage?.map((d, idx) => (
                  <div key={idx}>
                    {d.datum} {d.startzeit ? `• ${d.startzeit}` : ''}
                    {d.endzeit ? ` – ${d.endzeit}` : ''}
                  </div>
                ))}
              </div>
              {t.ort && (
                <div className="mt-2 text-gray-700">
                  Ort: {t.ort.standort || t.ort.veranstaltungsort || t.ort.stadt}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

