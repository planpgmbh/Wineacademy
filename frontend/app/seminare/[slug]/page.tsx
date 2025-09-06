import { getSeminar } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import BookingSidebar from './BookingSidebar';
import { mediaUrl } from '@/lib/api';
import type { SeminarListItem } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string } };

function fmtTime(t?: string) {
  if (!t) return '';
  // expect HH:MM:SS → HH:MM
  return t.slice(0, 5);
}

function fmtDateISOToGerman(iso: string) {
  // input YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function terminDateLine(t: NonNullable<Awaited<ReturnType<typeof getSeminar>>['termine']>[number]) {
  const days = t.tage || [];
  if (days.length === 0) return '';
  const first = days[0];
  if (days.length === 1) {
    return `${fmtDateISOToGerman(first.datum)} · ${fmtTime(first.startzeit)}–${fmtTime(first.endzeit)} Uhr`;
  }
  const last = days[days.length - 1];
  const sameMonthYear = first.datum.slice(0, 7) === last.datum.slice(0, 7);
  if (sameMonthYear) {
    // 24.–25.MM.YYYY
    const [y, m, d1] = first.datum.split('-');
    const d2 = last.datum.split('-')[2];
    return `${d1}.–${d2}.${m}.${y}`;
  }
  return `${fmtDateISOToGerman(first.datum)} – ${fmtDateISOToGerman(last.datum)}`;
}

export default async function SeminarDetailPage({ params }: Props) {
  const seminar = await getSeminar(params.slug);
  const termine = (seminar.termine ?? []) as NonNullable<SeminarListItem['termine']>;
  const bildUrl = mediaUrl(seminar.bild?.url);
  const nextTermin = termine[0];

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-600 mb-3">
        <Link href="/" className="hover:underline">Start</Link>
        <span className="mx-2">/</span>
        <Link href="/seminare" className="hover:underline">Seminare</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{seminar.seminarname}</span>
      </nav>

      {/* Header */}
      <header className="mb-6">
        {bildUrl && (
          <div className="mb-4 relative w-full aspect-[16/6] bg-gray-100 overflow-hidden rounded">
            <Image src={bildUrl} alt={seminar.bild?.alternativeText || seminar.seminarname} fill priority sizes="100vw" className="object-cover" />
          </div>
        )}
        <h1 className="text-3xl font-semibold">{seminar.seminarname}</h1>
        {seminar.kurzbeschreibung && (
          <p className="text-gray-700 mt-2 max-w-3xl">{seminar.kurzbeschreibung}</p>
        )}
        <div className="mt-3 text-sm text-gray-700 flex gap-6 flex-wrap">
          {typeof seminar.standardPreis !== 'undefined' && (
            <span>ab {seminar.standardPreis} €</span>
          )}
          {nextTermin && (
            <span>Nächster Termin: {terminDateLine(nextTermin)}</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Content */}
        <article className="md:col-span-2 space-y-6">
          {seminar.beschreibung && (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: seminar.beschreibung }} />
          )}
          {seminar.infos && (
            <section>
              <h2 className="text-xl font-medium mb-2">Zusätzliche Infos</h2>
              <p className="text-gray-800 whitespace-pre-line">{seminar.infos}</p>
            </section>
          )}
        </article>

        {/* Sidebar: Termine */}
        <aside className="md:col-span-1">
          <BookingSidebar termine={termine} fallbackPreis={seminar.standardPreis} />
        </aside>
      </div>
    </div>
  );
}
