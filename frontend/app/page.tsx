import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <section className="hero rounded-box bg-base-100 shadow">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <Image
            src="https://images.daisyui.com/images/stock/photo-1509223197845-458d87318791.jpg"
            alt="Weinverkostung"
            width={400}
            height={320}
            priority
            className="max-w-sm rounded-lg shadow-2xl"
          />
          <div>
            <h1 className="text-5xl font-bold">Wein erleben in Hamburg</h1>
            <p className="py-6">
              Von Grundlagen über Sensorik bis zu Masterclasses – die Wine Academy führt dich
              strukturiert durch die Welt des Weins.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="#" className="btn btn-primary">
                Seminare entdecken
              </Link>
              <Link href="#" className="btn btn-outline">
                Beratung anfragen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl font-semibold">Aktuelle Highlights</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Basis-Seminar</h3>
              <p>Perfekter Einstieg in die Verkostungstechnik und Rebsorten-Lehre.</p>
              <div className="card-actions justify-end">
                <Link href="#" className="btn btn-secondary btn-sm">
                  Zum Termin
                </Link>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Food &amp; Wine Pairing</h3>
              <p>Kulinarische Entdeckungsreise mit ausgewählten Weinbegleitungen.</p>
              <div className="card-actions justify-end">
                <Link href="#" className="btn btn-secondary btn-sm">
                  Mehr erfahren
                </Link>
              </div>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Private Tasting</h3>
              <p>Exklusive Events für Teams und Freundeskreise direkt im Loft.</p>
              <div className="card-actions justify-end">
                <Link href="#" className="btn btn-secondary btn-sm">
                  Anfrage senden
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl font-semibold">Warum Wine Academy?</h2>
        <div className="stats stats-vertical lg:stats-horizontal shadow">
          <div className="stat">
            <div className="stat-title">Teilnehmer:innen</div>
            <div className="stat-value">12k+</div>
            <div className="stat-desc">Seit 2010 begeistert</div>
          </div>

          <div className="stat">
            <div className="stat-title">Seminare</div>
            <div className="stat-value">35</div>
            <div className="stat-desc">Vom Beginner bis zur Profifortbildung</div>
          </div>

          <div className="stat">
            <div className="stat-title">Weine</div>
            <div className="stat-value">200+</div>
            <div className="stat-desc">Sorgfältig kuratiert für jede Session</div>
          </div>
        </div>
      </section>
    </div>
  );
}
