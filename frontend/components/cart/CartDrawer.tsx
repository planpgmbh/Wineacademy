"use client";

type CartDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ id, open, onClose }: CartDrawerProps) {
  return (
    <div className="drawer drawer-end">
      <input id={id} type="checkbox" className="drawer-toggle" checked={open} readOnly />
      <div className="drawer-content" />
      <div className="drawer-side">
        <label htmlFor={id} className="drawer-overlay" onClick={onClose} />
        <aside className="flex h-full w-96 max-w-full flex-col bg-base-100 shadow-xl">
          <header className="relative flex items-center justify-between gap-4 overflow-visible border-b border-base-300 bg-base-100 px-6 py-4 after:absolute after:inset-x-3 after:-bottom-3 after:h-4 after:rounded-full after:content-[''] after:shadow-[0_14px_18px_-12px_rgba(15,23,42,0.45)] after:pointer-events-none">
            <h2 className="text-lg font-semibold">Warenkorb</h2>
            <button type="button" aria-label="Schließen" className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto bg-base-200" />
          <footer className="flex flex-col gap-4 border-t border-base-300 px-6 py-6 shadow-[0_-6px_12px_-8px_rgb(15_23_42_/_0.12)]">
            <dl className="flex justify-between text-sm font-medium">
              <dt>Summe</dt>
              <dd>98,90 €</dd>
            </dl>
            <button type="button" className="btn btn-primary btn-lg rounded-full">Weiter zur Kasse</button>
          </footer>
        </aside>
      </div>
    </div>
  );
}
