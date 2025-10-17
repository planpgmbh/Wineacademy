"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BOOKING_SELECTION_STORAGE_KEY } from "@/components/seminar/bookingUtils";
import { readBookingSelection, readProductSelection } from "@/components/cart/useCartData";
import { PRODUCT_SELECTION_STORAGE_KEY } from "@/components/product/productBookingUtils";
import {
  fetchProductCheckoutData,
  fetchSeminarCheckoutData,
  formatCurrency,
  OrderParticipantInput,
  OrderPayload,
  OrderPositionInput,
  submitOrder
} from "@/lib/checkout";

type SeminarSelectionState = {
  selection: NonNullable<ReturnType<typeof readBookingSelection>>;
  seminarId: number;
  seminarTitle: string;
  terminId: number;
  terminLabel: string;
  terminDescription: string | null;
  preisBrutto: number | null;
};

type ProductSelectionState = {
  selection: NonNullable<ReturnType<typeof readProductSelection>>;
  productId: number;
  productTitle: string;
  preisBrutto: number | null;
  preisNetto: number | null;
  steuerSatz: number | null;
  isVoucher: boolean;
};

type Participant = {
  firstName: string;
  lastName: string;
  email: string;
};

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function CheckoutClient() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seminarState, setSeminarState] = useState<SeminarSelectionState | null>(null);
  const [productState, setProductState] = useState<ProductSelectionState | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [notes, setNotes] = useState("");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [orderInformation, setOrderInformation] = useState<{ id: number; bestellnummer?: string | null } | null>(null);

  useEffect(() => {
    async function loadSelections() {
      setLoading(true);
      setLoadError(null);
      try {
        const bookingSelection = readBookingSelection();
        const productSelection = readProductSelection();

        if (bookingSelection?.seminarSlug && bookingSelection.dateId) {
          const detail = await fetchSeminarCheckoutData(bookingSelection.seminarSlug);
          const termin = detail.termine.find((entry) => String(entry.id) === String(bookingSelection.dateId));
          if (!termin) {
            throw new Error("Ausgewählter Seminartermin ist leider nicht mehr verfügbar.");
          }
          setSeminarState({
            selection: bookingSelection,
            seminarId: detail.seminarId,
            seminarTitle: detail.seminarTitle,
            terminId: termin.id,
            terminLabel: termin.label,
            terminDescription: termin.description,
            preisBrutto: detail.preisBrutto
          });
        } else {
          setSeminarState(null);
        }

        if (productSelection?.productSlug) {
          const detail = await fetchProductCheckoutData(productSelection.productSlug);
          setProductState({
            selection: productSelection,
            productId: detail.productId,
            productTitle: detail.productTitle,
            preisBrutto: detail.preisBrutto,
            preisNetto: detail.preisNetto,
            steuerSatz: detail.steuerSatz,
            isVoucher: detail.isVoucher
          });
        } else {
          setProductState(null);
        }
      } catch (error) {
        console.error("[checkout] Laden der Auswahl fehlgeschlagen", error);
        setLoadError(
          error instanceof Error ? error.message : "Die ausgewählten Artikel konnten nicht geladen werden."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSelections();
  }, []);

  useEffect(() => {
    const seatCount = seminarState?.selection.quantity ?? 0;
    setParticipants((prev) => {
      const next = [...prev];
      if (seatCount <= 0) {
        return [];
      }
      if (next.length < seatCount) {
        for (let i = next.length; i < seatCount; i += 1) {
          next.push({
            firstName: i === 0 ? firstName : "",
            lastName: i === 0 ? lastName : "",
            email: email
          });
        }
      } else if (next.length > seatCount) {
        next.splice(seatCount);
      }
      return next;
    });
  }, [seminarState?.selection.quantity, firstName, lastName, email]);

  const summaryItems = useMemo(() => {
    const items: { title: string; quantity: number; price: string; description?: string | null }[] = [];
    if (seminarState) {
      items.push({
        title: seminarState.seminarTitle,
        quantity: seminarState.selection.quantity,
        price: formatCurrency(
          seminarState.preisBrutto != null
            ? seminarState.preisBrutto * seminarState.selection.quantity
            : null
        ),
        description: [seminarState.terminLabel, seminarState.terminDescription]
          .filter(Boolean)
          .join(" · ")
      });
    }
    if (productState) {
      items.push({
        title: productState.productTitle,
        quantity: productState.selection.quantity,
        price: formatCurrency(
          productState.preisBrutto != null
            ? productState.preisBrutto * productState.selection.quantity
            : null
        ),
        description: productState.isVoucher ? "Gutschein" : undefined
      });
    }
    return items;
  }, [productState, seminarState]);

  const totalFormatted = useMemo(() => {
    let total = 0;
    if (seminarState?.preisBrutto != null) {
      total += seminarState.preisBrutto * seminarState.selection.quantity;
    }
    if (productState?.preisBrutto != null) {
      total += productState.preisBrutto * productState.selection.quantity;
    }
    if (!Number.isFinite(total) || total <= 0) {
      return "Preis auf Anfrage";
    }
    return formatCurrency(total);
  }, [productState, seminarState]);

  const hasSelections = Boolean(seminarState || productState);

  const canSubmit =
    hasSelections &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    agbAccepted &&
    privacyAccepted &&
    (seminarState ? participants.every((p) => p.firstName.trim() && p.lastName.trim()) : true) &&
    submissionState !== "submitting";

  const handleParticipantChange = useCallback(
    (index: number, field: keyof Participant, value: string) => {
      setParticipants((prev) => {
        const next = [...prev];
        if (!next[index]) {
          next[index] = { firstName: "", lastName: "", email: "" };
        }
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const clearSelections = useCallback(() => {
    try {
      window.localStorage.removeItem(BOOKING_SELECTION_STORAGE_KEY);
      window.localStorage.removeItem(PRODUCT_SELECTION_STORAGE_KEY);
      window.localStorage.setItem("cart:count", "0");
    } catch (storageError) {
      console.warn("[checkout] Konnte Warenkorb nicht zurücksetzen:", storageError);
    }

    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("booking:pending", { detail: null }));
      document.dispatchEvent(new CustomEvent("product:pending", { detail: null }));
      document.dispatchEvent(new CustomEvent("cart:set", { detail: { count: 0 } }));
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) {
        return;
      }
      if (!hasSelections) {
        setSubmissionError("Es sind keine Artikel im Warenkorb.");
        return;
      }
      setSubmissionState("submitting");
      setSubmissionError(null);

      try {
        const positionen: OrderPositionInput[] = [];
        const buchungen: OrderParticipantInput[] = [];

        if (seminarState) {
          if (seminarState.preisBrutto == null) {
            throw new Error("Für die Seminarbuchung liegt kein Preis vor.");
          }
          positionen.push({
            typ: "seminar",
            titel: `${seminarState.seminarTitle} · ${seminarState.terminLabel}`,
            beschreibung: seminarState.terminDescription ?? undefined,
            terminId: seminarState.terminId,
            menge: Math.max(1, seminarState.selection.quantity),
            einzelpreisBrutto: seminarState.preisBrutto
          });

          const seatCount = Math.max(1, seminarState.selection.quantity);
          for (let i = 0; i < seatCount; i += 1) {
            const participant = participants[i] ?? participants[0] ?? { firstName, lastName, email };
            buchungen.push({
              vorname: participant.firstName.trim() || firstName.trim(),
              nachname: participant.lastName.trim() || lastName.trim(),
              email: participant.email.trim() || email.trim(),
              terminId: seminarState.terminId
            });
          }
        }

        if (productState) {
          if (productState.preisBrutto == null && productState.preisNetto == null) {
            throw new Error("Für die Produktposition liegt kein Preis vor.");
          }
          positionen.push({
            typ: productState.isVoucher ? "gutschein" : "produkt",
            titel: productState.productTitle,
            produktId: productState.productId,
            menge: Math.max(1, productState.selection.quantity),
            einzelpreisBrutto: productState.preisBrutto ?? undefined,
            einzelpreisNetto: productState.preisNetto ?? undefined,
            steuerSatz: productState.steuerSatz ?? undefined
          });
        }

        const payload: OrderPayload = {
          rechnungstyp: "privat",
          vorname: firstName.trim(),
          nachname: lastName.trim(),
          email: email.trim(),
          agbAkzeptiert: agbAccepted,
          datenschutzGelesen: privacyAccepted,
          newsletterOptIn: newsletter,
          positionen,
          buchungen,
          zahlungsmethode: "rechnung",
          notizen: notes.trim() || undefined
        };

        const response = await submitOrder(payload);
        clearSelections();
        setOrderInformation({ id: response.id, bestellnummer: response.bestellnummer });
        setSubmissionState("success");
        setSeminarState(null);
        setProductState(null);
      } catch (error) {
        console.error("[checkout] Bestellung fehlgeschlagen", error);
        setSubmissionError(error instanceof Error ? error.message : "Bestellung konnte nicht abgeschlossen werden.");
        setSubmissionState("error");
      }
    },
    [
      canSubmit,
      hasSelections,
      seminarState,
      participants,
      firstName,
      lastName,
      email,
      productState,
      agbAccepted,
      privacyAccepted,
      newsletter,
      notes,
      clearSelections
    ]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-8">
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-base-300" />
          <div className="h-32 animate-pulse rounded-2xl bg-base-300" />
          <div className="h-48 animate-pulse rounded-2xl bg-base-200" />
        </div>
      </div>
    );
  }

  if (!hasSelections) {
    if (submissionState === "success" && orderInformation) {
      return (
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:px-8">
          <h1 className="text-3xl font-semibold text-base-content">Vielen Dank für deine Bestellung!</h1>
          <p className="mt-4 text-base text-base-content/80">
            {orderInformation.bestellnummer
              ? `Deine Bestellnummer lautet ${orderInformation.bestellnummer}.`
              : "Du erhältst in Kürze eine Bestellbestätigung per E-Mail."}
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center md:px-8">
        <h1 className="text-3xl font-semibold text-base-content">Dein Warenkorb ist leer</h1>
        <p className="mt-4 text-base text-base-content/70">
          Füge zunächst ein Seminar oder Produkt hinzu, um mit der Bestellung fortzufahren.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-8">
      <h1 className="text-3xl font-semibold text-base-content">Checkout</h1>

      {loadError ? (
        <div className="mt-6 rounded-2xl bg-error/10 p-4 text-error">
          {loadError}
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <form className="space-y-10" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-base-content">Persönliche Angaben</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-sm font-medium">Vorname *</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text text-sm font-medium">Nachname *</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="mt-4">
              <label className="form-control">
                <span className="label-text text-sm font-medium">E-Mail *</span>
                <input
                  type="email"
                  className="input input-bordered"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="mt-4">
              <label className="form-control">
                <span className="label-text text-sm font-medium">Notizen</span>
                <textarea
                  className="textarea textarea-bordered min-h-[120px]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Besondere Hinweise oder Fragen an unser Team"
                />
              </label>
            </div>
            <div className="mt-4">
              <label className="label cursor-pointer gap-3">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={newsletter}
                  onChange={(event) => setNewsletter(event.target.checked)}
                />
                <span className="label-text text-sm">
                  Ich möchte Neuigkeiten der Wine Academy per E-Mail erhalten.
                </span>
              </label>
            </div>
          </section>

          {seminarState ? (
            <section className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-base-content">Teilnehmerdaten</h2>
              <p className="mt-2 text-sm text-base-content/70">
                Bitte gib die Namen (und optional E-Mail-Adressen) für alle Teilnehmerinnen und Teilnehmer an.
              </p>
              <div className="mt-6 space-y-6">
                {participants.map((participant, index) => (
                  <div key={index} className="rounded-xl border border-base-200 p-4">
                    <p className="text-sm font-semibold text-base-content/80">Teilnehmer {index + 1}</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <label className="form-control">
                        <span className="label-text text-sm">Vorname *</span>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={participant.firstName}
                          onChange={(event) => handleParticipantChange(index, "firstName", event.target.value)}
                          required
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text text-sm">Nachname *</span>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={participant.lastName}
                          onChange={(event) => handleParticipantChange(index, "lastName", event.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <div className="mt-3">
                      <label className="form-control">
                        <span className="label-text text-sm">E-Mail (optional)</span>
                        <input
                          type="email"
                          className="input input-bordered"
                          value={participant.email}
                          onChange={(event) => handleParticipantChange(index, "email", event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm space-y-3">
            <label className="label cursor-pointer gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={agbAccepted}
                onChange={(event) => setAgbAccepted(event.target.checked)}
              />
              <span className="label-text text-sm">
                Ich habe die Allgemeinen Geschäftsbedingungen gelesen und akzeptiere sie.
              </span>
            </label>
            <label className="label cursor-pointer gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              <span className="label-text text-sm">
                Ich stimme der Verarbeitung meiner Daten gemäß Datenschutzerklärung zu.
              </span>
            </label>
          </section>

          {submissionError ? (
            <div className="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error">
              {submissionError}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full md:w-auto"
            disabled={!canSubmit}
          >
            {submissionState === "submitting" ? "Bestellung wird übermittelt..." : "Kostenpflichtig bestellen"}
          </button>

          {submissionState === "success" && orderInformation ? (
            <div className="rounded-2xl border border-success bg-success/10 p-4 text-success">
              <p className="font-semibold">Vielen Dank für deine Bestellung!</p>
              <p className="mt-1 text-sm">
                {orderInformation.bestellnummer
                  ? `Deine Bestellnummer lautet ${orderInformation.bestellnummer}.`
                  : "Du erhältst in Kürze eine Bestellbestätigung per E-Mail."}
              </p>
            </div>
          ) : null}
        </form>

        <aside className="space-y-6 rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-base-content">Bestellübersicht</h2>
            <div className="mt-4 space-y-4">
              {summaryItems.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-base-200 p-4">
                  <p className="text-base font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-base-content/70">
                    Menge: {item.quantity}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-base-content/60">{item.description}</p>
                  ) : null}
                  <p className="mt-2 text-base font-semibold text-base-content">{item.price}</p>
                </div>
              ))}
            </div>
          </div>
          <dl className="flex items-center justify-between text-lg font-semibold">
            <dt>Gesamtsumme</dt>
            <dd>{totalFormatted}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
