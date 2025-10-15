const features = [
  {
    title: "Tailwind 4",
    description: "Utility-Klassen ohne zusätzliche Konfiguration — ready to go."
  },
  {
    title: "DaisyUI",
    description: "Komponenten und Themes sind out-of-the-box verfügbar."
  },
  {
    title: "Next.js 15",
    description: "App Router und React 19 bilden die Grundlage für alle kommenden Seiten."
  }
];

export default function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-primary">Los geht&apos;s</h2>
          <p className="text-base-content/70">
            Dieses Projekt startet bei Null. Ergänze deine Seiten, Komponenten und Datenflüsse
            komplett neu.
          </p>
          <div className="card-actions justify-end">
            <button className="btn btn-primary">Zur Dokumentation</button>
          </div>
        </div>
      </article>
      {features.map((feature) => (
        <article key={feature.title} className="card bg-base-100 border border-base-200">
          <div className="card-body">
            <h3 className="card-title">{feature.title}</h3>
            <p className="text-base-content/70">{feature.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
