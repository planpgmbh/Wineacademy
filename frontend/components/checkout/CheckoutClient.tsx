"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";

import {
  useCartData,
  type BookingSelection,
  type ProductSelection
} from "@/components/cart/useCartData";
import { BOOKING_SELECTION_STORAGE_KEY } from "@/components/seminar/bookingUtils";
import { PRODUCT_SELECTION_STORAGE_KEY } from "@/components/product/productBookingUtils";
import {
  VOUCHER_SELECTION_STORAGE_KEY,
  type VoucherSelection
} from "@/components/voucher/voucherBookingUtils";
import {
  fetchOrderById,
  fetchVoucherByCode,
  formatCurrency,
  OrderParticipantInput,
  OrderPayload,
  OrderPositionInput,
  OrderVoucherDetailsInput,
  submitOrder
} from "@/lib/checkout";
import { fetchJson } from "@/lib/api";
import { normaliseShippingInput, roundCurrency as roundCurrencyValue } from "@/lib/shipping";
import type { OrderResponse } from "@/lib/checkout";
import { PayPalButtons } from "@/components/payments/PayPalButtons";
import { CheckoutStepCard } from "@/components/checkout/CheckoutStepCard";

const INVOICE_POLL_INTERVAL_MS = 5000;
const MAX_INVOICE_POLL_ATTEMPTS = 12;

type SeminarSelectionState = {
  selectionId: string;
  selection: BookingSelection;
  seminarId: number | null;
  seminarTitle: string;
  seminarDescription: string | null;
  terminId: number | null;
  terminLabel: string;
  terminDescription: string | null;
  terminSlots: string[];
  preisBrutto: number | null;
  steuerSatz: number | null;
};

type ProductSelectionState = {
  selection: ProductSelection;
  productId: number;
  productTitle: string;
  preisBrutto: number | null;
  preisNetto: number | null;
  steuerSatz: number | null;
  isVoucher: boolean;
  shippingCost: number | null;
};

type VoucherSelectionState = {
  selection: VoucherSelection;
  amount: number;
  title: string;
  description?: string | null;
  shippingCost?: number | null;
};

type ParticipantFormValue = {
  firstName: string;
  lastName: string;
  email: string;
  wsetNumber: string;
  specialNeeds: string;
};

type BillingFormValue = {
  type: "privat" | "firma";
  companyName: string;
  vatId: string;
  invoiceEmail: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  phone: string;
};

type BillingFieldName = keyof BillingFormValue;

type ParticipantErrorState = {
  firstName: boolean;
  lastName: boolean;
};

type ParticipantGroupState = {
  selectionId: string;
  participants: ParticipantFormValue[];
  errors: ParticipantErrorState[];
};

type BillingErrorState = {
  companyName: string | null;
  invoiceEmail: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  phone: string | null;
};

type VoucherFormValue = {
  versandArt: "digital" | "physisch";
  empfaengerVorname: string;
  empfaengerNachname: string;
  empfaengerEmail: string;
  adresszusatz: string;
  strasse: string;
  plz: string;
  stadt: string;
  land: string;
  lieferDatum: string;
  persoenlicheNachricht: string;
};

type VoucherFormErrorState = {
  empfaengerVorname?: string | null;
  empfaengerNachname?: string | null;
  empfaengerEmail?: string | null;
  strasse?: string | null;
  plz?: string | null;
  stadt?: string | null;
  land?: string | null;
  lieferDatum?: string | null;
};

type VoucherItem = {
  key: "product" | "selection";
  title: string;
  subtitle?: string | null;
  quantity: number;
};

type StepId = "participants" | "gutscheine" | "billing" | "overview" | "payment" | "confirmation";

type StepDefinition = {
  id: StepId;
  label: string;
};

type PaymentMethod = "rechnung" | "paypal" | "lastschrift" | "kreditkarte";

type PaymentOption = {
  value: PaymentMethod;
  label: string;
  description?: string;
};

type PayPalOptionConfig = {
  title: string;
  helper: string;
  buttonLabel: "pay" | "checkout" | "buynow" | "paylater";
  fundingSource?: "paypal" | "card";
};

const createParticipantErrorState = (): ParticipantErrorState => ({
  firstName: false,
  lastName: false
});

const initialBillingErrors: BillingErrorState = {
  companyName: null,
  invoiceEmail: null,
  street: null,
  zip: null,
  city: null,
  country: null,
  contactFirstName: null,
  contactLastName: null,
  contactEmail: null,
  phone: null
};

const createVoucherFormValue = (): VoucherFormValue => ({
  versandArt: "digital",
  empfaengerVorname: "",
  empfaengerNachname: "",
  empfaengerEmail: "",
  adresszusatz: "",
  strasse: "",
  plz: "",
  stadt: "",
  land: DEFAULT_COUNTRY,
  lieferDatum: "",
  persoenlicheNachricht: ""
});

type SummaryItem = {
  id: string;
  title: string;
  quantity: number;
  description?: string | null;
  subtotal: number | null;
  netto: number | null;
  steuerSatz: number | null;
  type: "seminar" | "produkt" | "gutschein";
  shippingCost?: number | null;
  details?: string[];
};

type VoucherRedemption = {
  code: string;
  amount: number;
  remaining?: number | null;
  description?: string | null;
};

type SubmissionState = "idle" | "submitting" | "success" | "error";

const DEFAULT_COUNTRY = "Deutschland";
const DEFAULT_VAT_RATE = 19;
const roundCurrency = roundCurrencyValue;

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: "rechnung",
    label: "Auf Rechnung",
    description: "Zahle bequem nach Rechnungserhalt."
  },
  {
    value: "paypal",
    label: "PayPal",
    description: "Direkte Zahlung über dein PayPal-Konto."
  },
  {
    value: "lastschrift",
    label: "Lastschrift",
    description: "Der Betrag wird per SEPA-Lastschrift eingezogen."
  },
  {
    value: "kreditkarte",
    label: "Kreditkarte",
    description: "Zahlung per Visa, Mastercard oder American Express."
  }
];

const ORDER_PAYMENT_METHOD_MAP: Record<PaymentMethod, OrderPayload["zahlungsmethode"]> = {
  rechnung: "rechnung",
  paypal: "paypal",
  lastschrift: "paypal",
  kreditkarte: "paypal"
};

const PAYPAL_OPTION_CONFIG: Record<Exclude<PaymentMethod, "rechnung">, PayPalOptionConfig> = {
  paypal: {
    title: "Bezahlung mit PayPal",
    helper: "Du wirst zum PayPal-Checkout weitergeleitet und bestätigst die Zahlung dort mit deinem PayPal-Konto.",
    buttonLabel: "pay",
    fundingSource: "paypal"
  },
  lastschrift: {
    title: "Lastschrift über PayPal",
    helper: "PayPal zieht den Betrag nach Eingabe deiner Bankverbindung per SEPA-Lastschrift ein. Ein PayPal-Konto ist optional.",
    buttonLabel: "checkout"
  },
  kreditkarte: {
    title: "Kreditkarte über PayPal",
    helper: "PayPal verarbeitet die Kreditkartenzahlung (Visa, Mastercard, Amex). Die Daten werden ausschließlich bei PayPal erfasst.",
    buttonLabel: "checkout",
    fundingSource: "card"
  }
};

const PAYPAL_CONFIRMATION_MESSAGE: Record<Exclude<PaymentMethod, "rechnung">, string> = {
  paypal: "Deine Zahlung über PayPal wurde erfolgreich abgeschlossen.",
  lastschrift: "Die Abbuchung per Lastschrift erfolgt über PayPal.",
  kreditkarte: "Die Kreditkartenzahlung wurde über PayPal verarbeitet."
};

const VOUCHER_INTRO_LINES = [
  "Schenke unvergessliche Weinerlebnisse! Mit einem Gutschein der Wine Academy Hamburg öffnest du die Türen zu spannenden Weinseminaren, Verkostungen und Events.",
  "Verfügbar als digitaler Gutschein per E-Mail oder als handgeschriebene Karte per Post.",
  "Einfach Betrag eingeben und verschenken."
] as const;

const SUMMARY_VOUCHER_DESCRIPTION = "Verschenke die Wine Academy als Erlebnis.";

const STEP_DESCRIPTIONS: Partial<Record<StepId, string>> = {
  participants:
    "Bitte gib die Teilnehmerdaten für alle gebuchten Plätze ein. Die Angaben lassen sich vor Abschluss jederzeit anpassen.",
  gutscheine:
    `${VOUCHER_INTRO_LINES[0]} ${VOUCHER_INTRO_LINES[1]} ${VOUCHER_INTRO_LINES[2]}`,
  billing: "Wähle, ob die Rechnung auf eine Privatperson oder ein Unternehmen ausgestellt werden soll.",
  overview: "Prüfe alle Angaben vor dem Zahlungsschritt. Du kannst einzelne Bereiche jederzeit bearbeiten.",
  payment: "Wähle deine bevorzugte Zahlungsart und bestätige die rechtlichen Hinweise."
};

type CheckoutProgressProps = {
  steps: StepDefinition[];
  activeStepId: StepId;
  activeStepIndex: number;
  furthestStepIndex: number;
  onStepClick: (stepId: StepId) => void;
};

function CheckoutProgress({
  steps,
  activeStepId,
  activeStepIndex,
  furthestStepIndex,
  onStepClick
}: CheckoutProgressProps) {
  const progressIndex = Math.max(furthestStepIndex, activeStepIndex);
  const columnTemplateSegments: string[] = [];

  steps.forEach((_, index) => {
    columnTemplateSegments.push("minmax(0,min-content)");
    if (index < steps.length - 1) {
      columnTemplateSegments.push("1fr");
    }
  });

  const columnTemplate =
    columnTemplateSegments.length > 0 ? columnTemplateSegments.join(" ") : "minmax(0,1fr)";
  const combinedNodes: JSX.Element[] = [];

  steps.forEach((step, index) => {
    const isCompleted = index < progressIndex;
    const isActive = index === activeStepIndex;
    const canNavigate = index <= furthestStepIndex;

    const circleClasses = [
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-base-content/5 text-[12px] font-medium transition-colors duration-200",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    ];

    if (isActive) {
      circleClasses.push("border-primary bg-primary/10 text-primary", "font-semibold");
    } else if (isCompleted) {
      circleClasses.push("border-primary bg-primary/10 text-primary", "font-bold");
    } else {
      circleClasses.push("border-base-content/20 text-base-content/50");
    }

    if (canNavigate) {
      circleClasses.push("cursor-pointer hover:border-primary hover:text-primary");
    } else {
      circleClasses.push("cursor-default");
    }

    combinedNodes.push(
      <div key={`step-${step.id}`} className="flex justify-center">
        <button
          type="button"
          className={circleClasses.join(" ")}
          onClick={() => (canNavigate ? onStepClick(step.id) : undefined)}
          aria-current={isActive ? "step" : undefined}
          disabled={!canNavigate}
          aria-label={`Schritt ${index + 1}: ${step.label}`}
        >
          {index + 1}
          <span className="sr-only">{step.label}</span>
        </button>
      </div>
    );

    if (index < steps.length - 1) {
      combinedNodes.push(
        <div key={`connector-${step.id}`} className="flex items-center self-center">
          <div
            className={`h-px w-full rounded-full transition-colors duration-200 ${
              index < progressIndex ? "bg-primary" : "bg-base-content/20"
            }`}
            aria-hidden="true"
          />
        </div>
      );
    }
  });

  return (
    <nav aria-label="Checkout-Fortschritt" className="mt-8">
      <div className="grid items-center gap-4" style={{ gridTemplateColumns: columnTemplate }}>
        {combinedNodes}
      </div>
    </nav>
  );
}

function buildSteps(hasSeminar: boolean, hasVoucher: boolean): StepDefinition[] {
  const steps: StepDefinition[] = [];
  if (hasSeminar) {
    steps.push({ id: "participants", label: "Teilnehmer" });
  }
  if (hasVoucher) {
    steps.push({ id: "gutscheine", label: "Gutscheine" });
  }
  steps.push(
    { id: "billing", label: "Rechnungsadresse" },
    { id: "overview", label: "Bestellübersicht" },
    { id: "payment", label: "Zahlung" },
    { id: "confirmation", label: "Bestätigung" }
  );
  return steps;
}

function computeNetAmount(gross: number | null, taxRate: number | null): number | null {
  if (gross == null || !Number.isFinite(gross)) {
    return null;
  }
  if (taxRate == null || !Number.isFinite(taxRate)) {
    return null;
  }
  const rate = taxRate;
  if (rate <= 0) {
    return Math.round((gross + Number.EPSILON) * 100) / 100;
  }
  const net = gross / (1 + rate / 100);
  return Math.round((net + Number.EPSILON) * 100) / 100;
}

function computeSummaryItems(
  seminarStates: SeminarSelectionState[],
  productState: ProductSelectionState | null,
  voucherState: VoucherSelectionState | null,
  voucherForms: Record<string, VoucherFormValue>,
  shippingCostSetting: number | null
): SummaryItem[] {
  const items: SummaryItem[] = [];

  seminarStates.forEach((seminarState) => {
    const quantity = Math.max(1, seminarState.selection.quantity);
    const subtotal =
      seminarState.preisBrutto != null && Number.isFinite(seminarState.preisBrutto)
        ? seminarState.preisBrutto * quantity
        : null;
    const steuerSatz = seminarState.steuerSatz ?? DEFAULT_VAT_RATE;
    const netto = subtotal != null ? computeNetAmount(subtotal, steuerSatz) : null;

    const rawSlots =
      seminarState.terminSlots && seminarState.terminSlots.length > 0
        ? seminarState.terminSlots
        : seminarState.terminLabel
          ? [seminarState.terminLabel]
          : [];
    const formattedSlots = rawSlots.map((slot) => {
      const withoutTime = slot.split("·")[0] ?? slot;
      return withoutTime.replace(/,\s*/, " ").trim();
    });
    const seminarDescription = formattedSlots.length > 0 ? "Termine" : undefined;

    items.push({
      id: `seminar-${seminarState.selectionId}`,
      title: seminarState.seminarTitle,
      quantity,
      description: seminarDescription,
      subtotal,
      netto,
      steuerSatz,
      type: "seminar",
      details: formattedSlots.length > 0 ? formattedSlots : undefined
    });
  });

  if (productState) {
    const quantity = Math.max(1, productState.selection.quantity);
    const unitGross =
      productState.preisBrutto != null && Number.isFinite(productState.preisBrutto)
        ? productState.preisBrutto
        : productState.preisNetto != null && Number.isFinite(productState.preisNetto)
          ? productState.preisNetto
          : null;
    const subtotal =
      unitGross != null
        ? roundCurrency(unitGross * quantity)
        : productState.preisNetto != null && Number.isFinite(productState.preisNetto)
          ? roundCurrency(productState.preisNetto * quantity)
          : null;
    const unitNet =
      productState.preisNetto != null && Number.isFinite(productState.preisNetto)
        ? productState.preisNetto
        : unitGross != null
          ? computeNetAmount(unitGross, productState.steuerSatz)
          : null;
    const netto =
      unitNet != null
        ? roundCurrency(unitNet * quantity)
        : subtotal != null
          ? computeNetAmount(subtotal, productState.steuerSatz)
          : null;
    let shippingCost: number | null = null;

    if (productState.isVoucher) {
      const productForm = voucherForms?.product;
      const shippingSource =
        productForm?.versandArt === "physisch"
          ? normaliseShippingInput(
              productState.selection.shippingCost ?? voucherState?.shippingCost ?? shippingCostSetting ?? null
            )
          : null;
      if (shippingSource != null && shippingSource > 0) {
        shippingCost = roundCurrency(shippingSource);
      }
    } else {
      const shippingSource = normaliseShippingInput(productState.selection.shippingCost);
      if (shippingSource != null && shippingSource > 0) {
        shippingCost = roundCurrency(shippingSource);
      }
    }

    items.push({
      id: `product-${productState.productId}`,
      title: productState.productTitle,
      quantity,
      description: productState.isVoucher ? SUMMARY_VOUCHER_DESCRIPTION : undefined,
      subtotal,
      netto,
      steuerSatz: productState.steuerSatz,
      type: productState.isVoucher ? "gutschein" : "produkt",
      shippingCost: shippingCost && shippingCost > 0 ? shippingCost : undefined
    });
  }

  if (voucherState) {
    const selectionForm = voucherForms?.selection;
    const isPhysical = selectionForm?.versandArt === "physisch";
    const shippingSource = normaliseShippingInput(voucherState.shippingCost ?? shippingCostSetting ?? null);
    const shippingCost = isPhysical && shippingSource != null ? roundCurrency(shippingSource) : null;
    const baseValue = roundCurrency(voucherState.amount);
    items.push({
      id: "voucher-selection",
      title: voucherState.title,
      quantity: 1,
      description: SUMMARY_VOUCHER_DESCRIPTION,
      subtotal: baseValue,
      netto: baseValue,
      steuerSatz: 0,
      type: "gutschein",
      shippingCost: shippingCost != null && shippingCost > 0 ? shippingCost : undefined
    });
  }

  return items;
}

function computeTotals(items: SummaryItem[], voucher: VoucherRedemption | null) {
  const subtotal = items.reduce((acc, item) => acc + (item.subtotal ?? 0), 0);
  const shippingCandidates = items
    .map((item) => (item.shippingCost != null && item.shippingCost > 0 ? item.shippingCost : null))
    .filter((value): value is number => value != null);
  const shipping = shippingCandidates.length ? Math.max(...shippingCandidates) : 0;
  const discount = voucher ? Math.min(voucher.amount, subtotal) : 0;
  const taxableSubtotal = subtotal > 0 ? subtotal : 1;
  const taxBeforeDiscount = items.reduce((acc, item) => {
    if (item.subtotal == null) {
      return acc;
    }
    if (item.netto == null) {
      return acc;
    }
    return acc + Math.max(0, item.subtotal - item.netto);
  }, 0);
  const tax =
    subtotal > 0 ? Math.max(0, taxBeforeDiscount - (taxBeforeDiscount * discount) / taxableSubtotal) : 0;
  const total = Math.max(0, subtotal - discount + shipping);
  const net = Math.max(0, total - tax);

  return {
    subtotal: roundCurrency(subtotal),
    discount: roundCurrency(discount),
    tax: roundCurrency(tax),
    total: roundCurrency(total),
    net: roundCurrency(net),
    shipping: roundCurrency(shipping)
  };
}

export function CheckoutClient() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const cartState = useCartData();
  const cartData = cartState.data;

  const isPayPalConfigured = Boolean(PAYPAL_CLIENT_ID);

  const loading = cartState.status === "loading";
  const loadError =
    cartState.status === "error"
      ? cartState.error instanceof Error
        ? cartState.error.message || "Die ausgewählten Artikel konnten nicht geladen werden."
        : "Die ausgewählten Artikel konnten nicht geladen werden."
      : null;

  const seminarStates = useMemo<SeminarSelectionState[]>(() => {
    if (!Array.isArray(cartData.seminars) || cartData.seminars.length === 0) {
      return [];
    }
    return cartData.seminars
      .map((entry) => {
        const selection = entry.selection;
        const seminar = entry.seminar;
        const quantity = Math.max(1, Math.trunc(selection.quantity ?? 1));
        const normalizedSelection: BookingSelection = {
          ...selection,
          quantity,
          seminarTitle: selection.seminarTitle ?? seminar?.title ?? null
        };
        const terminIdValue = selection.dateId != null ? Number(selection.dateId) : NaN;
        const terminId = Number.isFinite(terminIdValue) ? terminIdValue : null;
        const matchingDate = seminar?.dates?.find((date) => {
          const dateId = typeof date.id === "number" ? String(date.id) : String(date.id ?? "");
          return selection.dateId != null && dateId === String(selection.dateId);
        });
        const terminLabel =
          matchingDate?.label ?? (selection.dateId ? `Termin #${selection.dateId}` : "Termin wird abgestimmt");
        const einzelpreisBrutto = seminar?.price?.value ?? null;
        const steuerSatz =
          seminar?.steuerSatz != null
            ? seminar.steuerSatz
            : einzelpreisBrutto != null
              ? DEFAULT_VAT_RATE
              : null;

        return {
          selectionId: selection.id,
          selection: normalizedSelection,
          seminarId: seminar?.id ?? null,
          seminarTitle: seminar?.title ?? normalizedSelection.seminarTitle ?? "Seminar",
          seminarDescription: seminar?.description ?? null,
          terminId,
          terminLabel,
          terminDescription: seminar?.description ?? null,
          terminSlots: Array.isArray(matchingDate?.slots) ? matchingDate.slots : [],
          preisBrutto: einzelpreisBrutto,
          steuerSatz
        };
      })
      .filter((entry) => entry.selection.quantity > 0);
  }, [cartData.seminars]);

  const productState = useMemo<ProductSelectionState | null>(() => {
    if (!cartData.product || !cartData.productSelection?.productSlug) {
      return null;
    }
    const selection = cartData.productSelection;
    const quantity = Math.max(1, Math.trunc(selection.quantity ?? 1));
    const fallbackGross = cartData.product.price.value ?? null;
    const fallbackNetto = cartData.product.priceNetto ?? null;
    const fallbackSteuer =
      cartData.product.steuerSatz != null
        ? cartData.product.steuerSatz
        : cartData.product.isVoucher
          ? 0
          : fallbackGross != null && fallbackNetto != null && fallbackNetto > 0
            ? Math.max(
                0,
                Math.round(((fallbackGross / fallbackNetto - 1) * 100 + Number.EPSILON) * 100) / 100
              )
            : null;
    const normalizedSelection: ProductSelection = {
      quantity,
      productSlug: selection.productSlug,
      productTitle: selection.productTitle ?? cartData.product.title,
      priceValue:
        selection.priceValue ?? fallbackGross,
      priceNetto:
        selection.priceNetto ?? fallbackNetto,
      priceFormatted:
        selection.priceFormatted ?? cartData.product.price.formatted ?? null,
      isVoucher: selection.isVoucher ?? cartData.product.isVoucher,
      steuerSatz: selection.steuerSatz ?? fallbackSteuer,
      shippingCost: normaliseShippingInput(selection.shippingCost) ?? null
    };
    const preisBrutto = normalizedSelection.priceValue ?? fallbackGross;
    const preisNetto = normalizedSelection.priceNetto ?? fallbackNetto;
    let steuerSatz = normalizedSelection.steuerSatz ?? fallbackSteuer;
    if (steuerSatz == null && preisBrutto != null && preisNetto != null && preisNetto > 0) {
      const ratio = preisBrutto / preisNetto;
      steuerSatz = Math.max(0, Math.round(((ratio - 1) * 100 + Number.EPSILON) * 100) / 100);
    }
    if (steuerSatz == null && (normalizedSelection.isVoucher || cartData.product.isVoucher)) {
      steuerSatz = 0;
    }

    const fallbackShipping = normaliseShippingInput(cartData.product.shippingCost ?? null);
    const shippingCost = normalizedSelection.shippingCost ?? fallbackShipping ?? null;
    normalizedSelection.shippingCost = shippingCost ?? null;

    return {
      selection: normalizedSelection,
      productId: cartData.product.id,
      productTitle: cartData.product.title,
      preisBrutto,
      preisNetto,
      steuerSatz,
      isVoucher: cartData.product.isVoucher,
      shippingCost
    };
  }, [cartData.product, cartData.productSelection]);

  const voucherState = useMemo<VoucherSelectionState | null>(() => {
    if (!cartData.voucherSelection) {
      return null;
    }
    const selection = cartData.voucherSelection;
    return {
      selection,
      amount: selection.amount,
      title: selection.title,
      description: selection.description ?? null,
      shippingCost: normaliseShippingInput(selection.shippingCost)
    };
  }, [cartData.voucherSelection]);

  const [shippingCostSetting, setShippingCostSetting] = useState<number | null>(
    voucherState?.shippingCost ?? null
  );

  useEffect(() => {
    if (voucherState?.shippingCost != null) {
      setShippingCostSetting(Math.round(voucherState.shippingCost * 100) / 100);
    }
  }, [voucherState?.shippingCost]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const template = await fetchJson<{ versandkosten?: number | string | null }>("/public/gutscheine/template", {
          cache: "no-store"
        });
        if (!active) {
          return;
        }
        const shipping = normaliseShippingInput(template?.versandkosten ?? null);
        if (shipping != null) {
          setShippingCostSetting(shipping);
        }
      } catch (error) {
        console.warn("[checkout] Versandkosten konnten nicht geladen werden:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [participantGroups, setParticipantGroups] = useState<ParticipantGroupState[]>([]);
  const [billing, setBilling] = useState<BillingFormValue>({
    type: "privat",
    companyName: "",
    vatId: "",
    invoiceEmail: "",
    street: "",
    zip: "",
    city: "",
    country: DEFAULT_COUNTRY,
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    phone: ""
  });
  const [billingErrors, setBillingErrors] = useState<BillingErrorState>(initialBillingErrors);
  const [newsletter, setNewsletter] = useState(false);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [agbError, setAgbError] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("rechnung");

  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherRedemption | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [voucherChecking, setVoucherChecking] = useState(false);

  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [orderInformation, setOrderInformation] = useState<{
    id: number;
    bestellnummer?: string | null;
    zahlungsmethode?: string | null;
    downloads?: {
      rechnung?: string | null;
      storno?: string | null;
    };
    totals?: OrderResponse["totals"] | null;
  } | null>(null);
  const [invoicePollingStarted, setInvoicePollingStarted] = useState(false);
  const [invoicePolling, setInvoicePolling] = useState(false);

  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [queriedOrderId, setQueriedOrderId] = useState<number | null>(null);
  const [submittedPaymentMethod, setSubmittedPaymentMethod] = useState<PaymentMethod | null>(null);

  const [stepError, setStepError] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<StepId>("billing");
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);

  const hasSeminarSelection = seminarStates.length > 0;
  const hasVoucherSelection = Boolean((productState && productState.isVoucher) || voucherState);
  const steps = useMemo(
    () => buildSteps(hasSeminarSelection, hasVoucherSelection),
    [hasSeminarSelection, hasVoucherSelection]
  );
  const isPayPalSelected = isPayPalConfigured && paymentMethod !== "rechnung";
  const activeStepIndex = useMemo(
    () => steps.findIndex((step) => step.id === activeStepId),
    [steps, activeStepId]
  );

  useEffect(() => {
    if (!steps.length) {
      return;
    }
    setFurthestStepIndex((current) => {
      const maxIndex = steps.length - 1;
      return current > maxIndex ? maxIndex : current;
    });
    const firstStepId = steps[0]?.id;
    if (!firstStepId) {
      return;
    }
    if (!steps.some((step) => step.id === activeStepId)) {
      setActiveStepId(firstStepId);
      return;
    }
    if (furthestStepIndex === 0 && activeStepId !== firstStepId) {
      setActiveStepId(firstStepId);
    }
  }, [steps, activeStepId, furthestStepIndex]);

  useEffect(() => {
    if (seminarStates.length === 0) {
      setParticipantGroups([]);
      return;
    }
    setParticipantGroups((prevGroups) => {
      const nextGroups: ParticipantGroupState[] = [];
      seminarStates.forEach((seminar) => {
        const requiredSeats = Math.max(1, Math.trunc(seminar.selection.quantity ?? 1));
        const existing = prevGroups.find((group) => group.selectionId === seminar.selectionId);
        const participants = existing ? [...existing.participants] : [];
        if (participants.length < requiredSeats) {
          for (let i = participants.length; i < requiredSeats; i += 1) {
            participants.push({
              firstName: "",
              lastName: "",
              email: "",
              wsetNumber: "",
              specialNeeds: ""
            });
          }
        } else if (participants.length > requiredSeats) {
          participants.splice(requiredSeats);
        }
        const errors = existing ? [...existing.errors] : [];
        if (errors.length < participants.length) {
          for (let i = errors.length; i < participants.length; i += 1) {
            errors.push(createParticipantErrorState());
          }
        } else if (errors.length > participants.length) {
          errors.splice(participants.length);
        }
        nextGroups.push({ selectionId: seminar.selectionId, participants, errors });
      });
      return nextGroups;
    });
  }, [seminarStates]);

  const participantGroupsWithMeta = useMemo(() => {
    if (seminarStates.length === 0) {
      return [];
    }
    return seminarStates.map((seminar) => {
      const group =
        participantGroups.find((entry) => entry.selectionId === seminar.selectionId) ??
        ({
          selectionId: seminar.selectionId,
          participants: [],
          errors: []
        } satisfies ParticipantGroupState);
      return { seminar, group };
    });
  }, [participantGroups, seminarStates]);

  const primaryParticipant = useMemo(() => {
    return participantGroupsWithMeta[0]?.group.participants[0] ?? null;
  }, [participantGroupsWithMeta]);

  useEffect(() => {
    if (!primaryParticipant) {
      return;
    }
    setBilling((prev) => {
      if (prev.contactFirstName || prev.contactLastName || prev.contactEmail) {
        return prev;
      }
      return {
        ...prev,
        contactFirstName: primaryParticipant.firstName,
        contactLastName: primaryParticipant.lastName,
        contactEmail: primaryParticipant.email
      };
    });
  }, [primaryParticipant]);

  useEffect(() => {
    if (!isPayPalSelected && paypalError) {
      setPaypalError(null);
    }
  }, [isPayPalSelected, paypalError]);

  useEffect(() => {
    setStepError(null);
  }, [paymentMethod]);

  useEffect(() => {
    if (!isPayPalConfigured && paymentMethod !== "rechnung") {
      setPaymentMethod("rechnung");
    }
  }, [isPayPalConfigured, paymentMethod]);

  const hasSelections = Boolean(seminarStates.length > 0 || productState || voucherState);

  const voucherItems = useMemo<VoucherItem[]>(() => {
    const items: VoucherItem[] = [];
    if (productState?.isVoucher) {
      items.push({
        key: "product",
        title: productState.productTitle,
        subtitle: productState.selection.productTitle ?? null,
        quantity: Math.max(1, Math.trunc(productState.selection.quantity ?? 1))
      });
    }
    if (voucherState) {
      items.push({
        key: "selection",
        title: voucherState.title,
        subtitle: null,
        quantity: 1
      });
    }
    return items;
  }, [productState, voucherState]);

  const [voucherForms, setVoucherForms] = useState<Record<string, VoucherFormValue>>({});
  const [voucherFormErrors, setVoucherFormErrors] = useState<Record<string, VoucherFormErrorState>>({});

  useEffect(() => {
    setVoucherForms((prev) => {
      const next: Record<string, VoucherFormValue> = {};
      voucherItems.forEach((item) => {
        next[item.key] = prev[item.key] ?? createVoucherFormValue();
      });
      return next;
    });
    setVoucherFormErrors((prev) => {
      const next: Record<string, VoucherFormErrorState> = {};
      voucherItems.forEach((item) => {
        next[item.key] = prev[item.key] ?? {};
      });
      return next;
    });
  }, [voucherItems]);

  const summaryItems = useMemo(
    () => computeSummaryItems(seminarStates, productState, voucherState, voucherForms, shippingCostSetting),
    [seminarStates, productState, voucherState, voucherForms, shippingCostSetting]
  );
  const totals = useMemo(() => computeTotals(summaryItems, appliedVoucher), [summaryItems, appliedVoucher]);

  const moveToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= steps.length) {
        return;
      }
      setActiveStepId(steps[nextIndex].id);
      setFurthestStepIndex((current) => Math.max(current, nextIndex));
    },
    [steps]
  );

  const goToStep = useCallback(
    (target: StepId) => {
      const targetIndex = steps.findIndex((step) => step.id === target);
      if (targetIndex === -1) {
        return;
      }
      if (targetIndex <= furthestStepIndex || steps[targetIndex].id === "confirmation") {
        setActiveStepId(steps[targetIndex].id);
      }
    },
    [furthestStepIndex, steps]
  );

  const handleBack = useCallback(() => {
    if (activeStepIndex <= 0) {
      return;
    }
    moveToStep(activeStepIndex - 1);
  }, [activeStepIndex, moveToStep]);

  const handleParticipantChange = useCallback(
    (selectionId: string, index: number, field: keyof ParticipantFormValue, value: string) => {
      setParticipantGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.selectionId !== selectionId) {
            return group;
          }
          const participants = [...group.participants];
          if (!participants[index]) {
            return group;
          }
          participants[index] = { ...participants[index], [field]: value };
          const errors = [...group.errors];
          if (field === "firstName" || field === "lastName") {
            if (errors[index]) {
              errors[index] = {
                ...errors[index],
                [field === "firstName" ? "firstName" : "lastName"]: false
              };
            }
          }
          return { ...group, participants, errors };
        })
      );
    },
    []
  );

  const handleBillingChange = useCallback(<K extends keyof BillingFormValue>(key: K, value: BillingFormValue[K]) => {
    setBilling((prev) => ({ ...prev, [key]: value }));
    switch (key) {
      case "companyName":
      case "invoiceEmail":
      case "street":
      case "zip":
      case "city":
      case "country":
      case "contactFirstName":
      case "contactLastName":
      case "contactEmail":
      case "phone":
        setBillingErrors((prev) => ({ ...prev, [key]: null }));
        break;
      default:
        break;
    }
  }, []);

  const handleVoucherFieldChange = useCallback(
    (key: VoucherItem["key"], field: keyof VoucherFormValue, value: string) => {
      setVoucherForms((prev) => {
        const current = prev[key] ?? createVoucherFormValue();
        return {
          ...prev,
          [key]: {
            ...current,
            [field]: value
          }
        };
      });
      if (
        field === "empfaengerVorname" ||
        field === "empfaengerNachname" ||
        field === "empfaengerEmail" ||
        field === "strasse" ||
        field === "plz" ||
        field === "stadt" ||
        field === "land" ||
        field === "lieferDatum"
      ) {
        setVoucherFormErrors((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] ?? {}),
            [field]: null
          }
        }));
      }
    },
    []
  );

  const handleVoucherVersandArtChange = useCallback(
    (key: VoucherItem["key"], versandArt: "digital" | "physisch") => {
      setVoucherForms((prev) => {
        const current = prev[key] ?? createVoucherFormValue();
        return {
          ...prev,
          [key]: {
            ...current,
            versandArt
          }
        };
      });
      setVoucherFormErrors((prev) => {
        const current = prev[key] ?? {};
        const nextErrors: VoucherFormErrorState = { ...current };
        if (versandArt === "digital") {
          delete nextErrors.strasse;
          delete nextErrors.plz;
          delete nextErrors.stadt;
          delete nextErrors.land;
        } else {
          delete nextErrors.empfaengerEmail;
        }
        return {
          ...prev,
          [key]: nextErrors
        };
      });
    },
    []
  );

  const handleBillingTypeChange = useCallback((type: "privat" | "firma") => {
    setBilling((prev) => ({
      ...prev,
      type,
      companyName: type === "firma" ? prev.companyName : "",
      vatId: type === "firma" ? prev.vatId : "",
      invoiceEmail: type === "firma" ? prev.invoiceEmail : ""
    }));
    if (type === "privat") {
      setBillingErrors((prev) => ({
        ...prev,
        companyName: null,
        invoiceEmail: null
      }));
    }
  }, []);

  const validateParticipants = useCallback(() => {
    if (seminarStates.length === 0) {
      setParticipantGroups([]);
      setStepError(null);
      return true;
    }
    if (participantGroups.length === 0) {
      setStepError("Bitte gib mindestens einen Teilnehmer ein.");
      return false;
    }

    let hasErrors = false;
    setParticipantGroups((prevGroups) =>
      prevGroups.map((group) => {
        const errors = group.participants.map((participant) => {
          const error = {
            firstName: !participant.firstName.trim(),
            lastName: !participant.lastName.trim()
          };
          if (error.firstName || error.lastName) {
            hasErrors = true;
          }
          return error;
        });
        return { ...group, errors };
      })
    );

    if (hasErrors) {
      setStepError("Bitte fülle alle Pflichtfelder bei den Teilnehmerdaten aus.");
      return false;
    }

    setStepError(null);
    return true;
  }, [participantGroups, seminarStates]);

  const validateBilling = useCallback(() => {
    const errors: BillingErrorState = { ...initialBillingErrors };
    let firstError: string | null = null;

    const registerError = (key: keyof BillingErrorState, message: string) => {
      errors[key] = message;
      if (!firstError) {
        firstError = message;
      }
    };

    if (!billing.street.trim()) {
      registerError("street", "Bitte trage die Straße für die Rechnungsadresse ein.");
    }
    if (!billing.zip.trim()) {
      registerError("zip", "Bitte trage die Postleitzahl ein.");
    }
    if (!billing.city.trim()) {
      registerError("city", "Bitte trage die Stadt ein.");
    }
    if (!billing.country.trim()) {
      registerError("country", "Bitte trage das Land ein.");
    }
    if (!billing.contactFirstName.trim()) {
      registerError("contactFirstName", "Bitte trage den Vornamen der Kontaktperson ein.");
    }
    if (!billing.contactLastName.trim()) {
      registerError("contactLastName", "Bitte trage den Nachnamen der Kontaktperson ein.");
    }
    if (!billing.contactEmail.trim()) {
      registerError("contactEmail", "Bitte trage die E-Mail-Adresse der Kontaktperson ein.");
    }
    if (!billing.phone.trim()) {
      registerError("phone", "Bitte ergänze eine Telefonnummer für Rückfragen.");
    }

    if (billing.type === "firma") {
      if (!billing.companyName.trim()) {
        registerError("companyName", "Bitte trage den Firmennamen ein.");
      }
      if (!billing.invoiceEmail.trim()) {
        registerError("invoiceEmail", "Bitte gib die Rechnungs-E-Mail an.");
      }
    }

    const emailPattern = /\S+@\S+\.\S+/;
    if (billing.contactEmail.trim() && !emailPattern.test(billing.contactEmail.trim())) {
      registerError("contactEmail", "Die E-Mail-Adresse der Kontaktperson ist ungültig.");
    }
    if (billing.type === "firma" && billing.invoiceEmail.trim() && !emailPattern.test(billing.invoiceEmail.trim())) {
      registerError("invoiceEmail", "Die Rechnungs-E-Mail ist ungültig.");
    }

    setBillingErrors(errors);

    if (firstError) {
      setStepError(firstError);
      return false;
    }

    setStepError(null);
    return true;
  }, [billing]);

  const validateVoucherDetails = useCallback(() => {
    if (voucherItems.length === 0) {
      setStepError(null);
      return true;
    }
    const emailPattern = /\S+@\S+\.\S+/;
    let firstError: string | null = null;
    const nextErrors: Record<string, VoucherFormErrorState> = {};

    voucherItems.forEach((item) => {
      const form = voucherForms[item.key] ?? createVoucherFormValue();
      const errors: VoucherFormErrorState = {};
      const trimmedFirstName = form.empfaengerVorname.trim();
      const trimmedLastName = form.empfaengerNachname.trim();
      if (!trimmedFirstName) {
        errors.empfaengerVorname = "Bitte gib den Vornamen der beschenkten Person ein.";
      }
      if (!trimmedLastName) {
        errors.empfaengerNachname = "Bitte gib den Nachnamen der beschenkten Person ein.";
      }
      if (form.versandArt === "digital") {
        const trimmedEmail = form.empfaengerEmail.trim();
        if (trimmedEmail && !emailPattern.test(trimmedEmail)) {
          errors.empfaengerEmail = "Die eingegebene E-Mail-Adresse ist ungültig.";
        }
      } else {
        if (!form.strasse.trim()) {
          errors.strasse = "Bitte ergänze die Straße für den postalischen Versand.";
        }
        if (!form.plz.trim()) {
          errors.plz = "Bitte ergänze die Postleitzahl für den postalischen Versand.";
        }
        if (!form.stadt.trim()) {
          errors.stadt = "Bitte ergänze die Stadt für den postalischen Versand.";
        }
        if (!form.land.trim()) {
          errors.land = "Bitte ergänze das Land für den postalischen Versand.";
        }
      }
      if (form.lieferDatum.trim()) {
        const parsedDate = new Date(form.lieferDatum);
        if (Number.isNaN(parsedDate.valueOf())) {
          errors.lieferDatum = "Das gewünschte Lieferdatum ist ungültig.";
        }
      }

      if (!firstError) {
        const firstEntry = Object.values(errors).find((message) => message);
        if (firstEntry) {
          firstError = firstEntry;
        }
      }

      nextErrors[item.key] = errors;
    });

    setVoucherFormErrors(nextErrors);

    if (firstError) {
      setStepError(firstError);
      return false;
    }

    setStepError(null);
    return true;
  }, [voucherItems, voucherForms]);

  const validatePayment = useCallback(() => {
    let errorMessage: string | null = null;

    if (!agbAccepted) {
      setAgbError(true);
      errorMessage = "Bitte bestätige die Allgemeinen Geschäftsbedingungen.";
    } else {
      setAgbError(false);
    }

    if (!privacyAccepted) {
      setPrivacyError(true);
      if (!errorMessage) {
        errorMessage = "Bitte bestätige den Datenschutzhinweis.";
      }
    } else {
      setPrivacyError(false);
    }

    if (!paymentMethod && !errorMessage) {
      errorMessage = "Bitte wähle eine Zahlungsmethode aus.";
    }

    if (errorMessage) {
      setStepError(errorMessage);
      return false;
    }

    setStepError(null);
    return true;
  }, [agbAccepted, paymentMethod, privacyAccepted]);

  const clearSelections = useCallback(() => {
    try {
      window.localStorage.removeItem(BOOKING_SELECTION_STORAGE_KEY);
      window.localStorage.removeItem(PRODUCT_SELECTION_STORAGE_KEY);
      window.localStorage.removeItem(VOUCHER_SELECTION_STORAGE_KEY);
      window.localStorage.setItem("cart:count", "0");
    } catch (storageError) {
      console.warn("[checkout] Konnte Warenkorb nicht zurücksetzen:", storageError);
    }

    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("booking:pending", { detail: null }));
      document.dispatchEvent(new CustomEvent("product:pending", { detail: null }));
      document.dispatchEvent(new CustomEvent("voucher:pending", { detail: null }));
      document.dispatchEvent(new CustomEvent("cart:set", { detail: { count: 0 } }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const orderParam = new URLSearchParams(window.location.search).get("order");
    if (!orderParam) {
      return;
    }
    const id = Number(orderParam);
    if (!Number.isFinite(id)) {
      return;
    }
    if ((submissionState === "success" && orderInformation?.id === id) || queriedOrderId === id) {
      return;
    }

    let isActive = true;
    (async () => {
      try {
        const detail = await fetchOrderById(id);
        if (!isActive || !detail?.id) {
          return;
        }
        setOrderInformation({
          id: detail.id,
          bestellnummer: detail.bestellnummer ?? null,
          zahlungsmethode: detail.zahlungsmethode ?? null,
          downloads: detail.downloads,
          totals: detail.totals ?? null
        });
        setSubmissionState("success");
        setActiveStepId("confirmation");
        setFurthestStepIndex(buildSteps(false, false).length - 1);
        setQueriedOrderId(id);
        setParticipantGroups([]);
        setAppliedVoucher(null);
        setVoucherInput("");
        setVoucherMessage(null);
        setSubmittedPaymentMethod(null);
        clearSelections();
      } catch (error) {
        if (isActive) {
          console.warn("[checkout] Bestellung konnte nicht geladen werden:", error);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [submissionState, orderInformation?.id, queriedOrderId, clearSelections]);

  useEffect(() => {
    if (submissionState !== "success" || !orderInformation?.id) {
      if (invoicePolling || invoicePollingStarted) {
        setInvoicePolling(false);
        setInvoicePollingStarted(false);
      }
      return;
    }

    if (orderInformation.downloads?.rechnung) {
      if (invoicePolling || invoicePollingStarted) {
        setInvoicePolling(false);
        setInvoicePollingStarted(false);
      }
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    if (!invoicePollingStarted) {
      setInvoicePollingStarted(true);
    }
    if (!invoicePolling) {
      setInvoicePolling(true);
    }

    const poll = async () => {
      if (cancelled) {
        return;
      }
      attempts += 1;

      try {
        const detail = await fetchOrderById(orderInformation.id);
        if (!cancelled && detail?.downloads?.rechnung) {
          setOrderInformation((prev) => {
            if (!prev || prev.id !== detail.id) {
              return prev;
            }
            return {
              ...prev,
              bestellnummer: detail.bestellnummer ?? prev.bestellnummer,
              zahlungsmethode: detail.zahlungsmethode ?? prev.zahlungsmethode,
              downloads: detail.downloads
            };
          });
          setInvoicePolling(false);
          setInvoicePollingStarted(false);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[checkout] Rechnungspolling fehlgeschlagen:", error);
        }
      }

      if (!cancelled) {
        if (attempts < MAX_INVOICE_POLL_ATTEMPTS) {
          timeoutId = setTimeout(poll, INVOICE_POLL_INTERVAL_MS);
        } else {
          setInvoicePolling(false);
        }
      }
    };

    timeoutId = setTimeout(poll, INVOICE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    submissionState,
    orderInformation?.id,
    orderInformation?.downloads?.rechnung,
    invoicePolling,
    invoicePollingStarted
  ]);

  const handleRemoveVoucher = useCallback(() => {
    setAppliedVoucher(null);
    setVoucherMessage("Der Gutscheincode wurde entfernt.");
  }, []);

  const normaliseVoucherDetailsForSubmit = useCallback(
    (form: VoucherFormValue | undefined, shippingCost?: number | null): OrderVoucherDetailsInput | undefined => {
      if (!form) {
        return undefined;
      }
      const versandArt = form.versandArt === "physisch" ? "physisch" : "digital";
      const trim = (value: string) => value.trim();
      const empfaengerVorname = trim(form.empfaengerVorname);
      const empfaengerNachname = trim(form.empfaengerNachname);
      if (!empfaengerVorname || !empfaengerNachname) {
        return undefined;
      }
      const details: OrderVoucherDetailsInput = {
        versandArt,
        empfaengerVorname,
        empfaengerNachname
      };
      const email = trim(form.empfaengerEmail);
      if (email) {
        details.empfaengerEmail = email;
      }
      const adresszusatz = trim(form.adresszusatz);
      if (adresszusatz) {
        details.adresszusatz = adresszusatz;
      }
      if (versandArt === "physisch") {
        const strasse = trim(form.strasse);
        const plz = trim(form.plz);
        const stadt = trim(form.stadt);
        const land = trim(form.land) || DEFAULT_COUNTRY;
        if (strasse) {
          details.strasse = strasse;
        }
        if (plz) {
          details.plz = plz;
        }
        if (stadt) {
          details.stadt = stadt;
        }
        if (land) {
          details.land = land;
        }
      }
      const lieferDatum = trim(form.lieferDatum);
      if (lieferDatum) {
        details.lieferDatum = lieferDatum;
      }
      const message = trim(form.persoenlicheNachricht);
      if (message) {
        details.persoenlicheNachricht = message;
      }
      if (versandArt === "physisch") {
        const normalisedShipping = normaliseShippingInput(shippingCost);
        if (normalisedShipping != null && normalisedShipping > 0) {
          details.versandkosten = normalisedShipping;
        }
      }
      return details;
    },
    []
  );

  const handleSubmitOrder = useCallback(async (paypalDetails?: { orderId?: string; captureId?: string }) => {
    if (!hasSelections) {
      setSubmissionError("Der Warenkorb ist leer.");
      setSubmissionState("error");
      return;
    }

    const isPayPalFlow = isPayPalConfigured && paymentMethod !== "rechnung";

    if (isPayPalFlow && !paypalDetails?.captureId) {
      setSubmissionError("Die PayPal-Zahlung konnte nicht abgeschlossen werden.");
      setSubmissionState("error");
      return;
    }

    setSubmissionState("submitting");
    setSubmissionError(null);
    setPaypalError(null);

    try {
      const positionen: OrderPositionInput[] = [];
      const buchungen: OrderParticipantInput[] = [];

      if (seminarStates.length > 0) {
        seminarStates.forEach((seminarStateEntry) => {
          if (seminarStateEntry.preisBrutto == null) {
            throw new Error("Für die Seminarbuchung liegt kein Preis vor.");
          }
          if (seminarStateEntry.terminId == null) {
            throw new Error("Für die Seminarbuchung liegt kein Termin vor.");
          }
          const seatCount = Math.max(1, seminarStateEntry.selection.quantity);
          const steuerSatz = seminarStateEntry.steuerSatz ?? DEFAULT_VAT_RATE;
          const einzelpreisBrutto = seminarStateEntry.preisBrutto;
          const einzelpreisNetto = computeNetAmount(einzelpreisBrutto, steuerSatz) ?? undefined;

          positionen.push({
            typ: "seminar",
            titel: `${seminarStateEntry.seminarTitle} · ${seminarStateEntry.terminLabel}`,
            beschreibung: seminarStateEntry.terminDescription ?? undefined,
            terminId: seminarStateEntry.terminId,
            menge: seatCount,
            einzelpreisBrutto,
            einzelpreisNetto,
            steuerSatz
          });

          const group = participantGroupsWithMeta.find(
            ({ seminar }) => seminar.selectionId === seminarStateEntry.selectionId
          )?.group;
          const participantsForSeminar = group?.participants ?? [];
          if (participantsForSeminar.length === 0) {
            throw new Error("Teilnehmerdaten fehlen.");
          }

          for (let index = 0; index < seatCount; index += 1) {
            const participant = participantsForSeminar[index] ?? participantsForSeminar[0];
            if (!participant) {
              throw new Error("Teilnehmerdaten fehlen.");
            }
            buchungen.push({
              vorname: participant.firstName.trim() || billing.contactFirstName.trim(),
              nachname: participant.lastName.trim() || billing.contactLastName.trim(),
              email: participant.email.trim() || billing.contactEmail.trim(),
              terminId: seminarStateEntry.terminId,
              wsetCandidateNumber: participant.wsetNumber.trim() || undefined,
              besondereBeduerfnisse: participant.specialNeeds.trim() || undefined
            });
          }
        });
      }

      if (productState) {
        if (productState.preisBrutto == null && productState.preisNetto == null) {
          throw new Error("Für die gewählte Produktposition liegt kein Preis vor.");
        }
        const quantity = Math.max(1, productState.selection.quantity);
        const einzelpreisBrutto = productState.preisBrutto ?? undefined;
        const einzelpreisNetto =
          productState.preisNetto != null
            ? productState.preisNetto
            : computeNetAmount(productState.preisBrutto, productState.steuerSatz) ?? undefined;
        const productVoucherDetails = productState.isVoucher
          ? normaliseVoucherDetailsForSubmit(
              voucherForms["product"],
              voucherState?.shippingCost ?? shippingCostSetting ?? null
            )
          : undefined;

        positionen.push({
          typ: productState.isVoucher ? "gutschein" : "produkt",
          titel: productState.productTitle,
          produktId: productState.productId,
          menge: quantity,
          einzelpreisBrutto,
          einzelpreisNetto,
          steuerSatz: productState.steuerSatz ?? undefined,
          ...(productState.isVoucher && productVoucherDetails ? { gutscheinDetails: productVoucherDetails } : {})
        });
      }

      if (voucherState) {
        const selectionVoucherDetails = normaliseVoucherDetailsForSubmit(
          voucherForms["selection"],
          voucherState?.shippingCost ?? shippingCostSetting ?? null
        );
        positionen.push({
          typ: "gutschein",
          titel: voucherState.title,
          beschreibung: voucherState.description ?? undefined,
          menge: 1,
          betrag: voucherState.amount,
          ...(selectionVoucherDetails ? { gutscheinDetails: selectionVoucherDetails } : {})
        });
      }

      const payPalNote = isPayPalFlow
        ? `Gewählte Zahlungsart: ${
            paymentMethod === "paypal"
              ? "PayPal-Konto"
              : paymentMethod === "lastschrift"
                ? "Lastschrift über PayPal"
                : "Kreditkarte über PayPal"
          }.`
        : null;

      const payload: OrderPayload = {
        rechnungstyp: billing.type,
        vorname: billing.contactFirstName.trim(),
        nachname: billing.contactLastName.trim(),
        email: billing.contactEmail.trim(),
        agbAkzeptiert: agbAccepted,
        datenschutzGelesen: privacyAccepted,
        newsletterOptIn: newsletter,
        positionen,
        buchungen,
        zahlungsmethode: ORDER_PAYMENT_METHOD_MAP[paymentMethod] ?? "rechnung",
        notizen: payPalNote || undefined,
        paypalOrderId: isPayPalFlow ? paypalDetails?.orderId : undefined,
        paypalCaptureId: isPayPalFlow ? paypalDetails?.captureId : undefined,
        firmenname: billing.type === "firma" ? billing.companyName.trim() || undefined : undefined,
        ustId: billing.type === "firma" ? billing.vatId.trim() || undefined : undefined,
        rechnungsEmail: billing.type === "firma" ? billing.invoiceEmail.trim() : undefined,
        strasse: billing.street.trim(),
        plz: billing.zip.trim(),
        stadt: billing.city.trim(),
        land: billing.country.trim(),
        telefon: billing.phone.trim(),
        gutscheinBetrag: appliedVoucher?.amount,
        gutscheinCode: appliedVoucher?.code || undefined
      };

      const response = await submitOrder(payload);
      clearSelections();
      setOrderInformation({
        id: response.id,
        bestellnummer: response.bestellnummer,
        zahlungsmethode: response.zahlungsmethode,
        downloads: response.downloads,
        totals: response.totals ?? null
      });
      setQueriedOrderId(response.id);
      setSubmissionState("success");
      setSubmittedPaymentMethod(isPayPalFlow ? paymentMethod : null);
      setParticipantGroups([]);
      setAppliedVoucher(null);
      setVoucherInput("");
      setVoucherMessage(null);
      setFurthestStepIndex(steps.length - 1);
      setActiveStepId("confirmation");

      if (typeof window !== "undefined") {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("order", String(response.id));
        router.replace(`${currentUrl.pathname}${currentUrl.search}`);
      }
    } catch (error) {
      console.error("[checkout] Bestellung fehlgeschlagen", error);
      setSubmissionError(error instanceof Error ? error.message : "Bestellung konnte nicht abgeschlossen werden.");
      setSubmissionState("error");
    }
  }, [
    hasSelections,
    seminarStates,
    productState,
    voucherState,
    participantGroupsWithMeta,
    billing,
    agbAccepted,
    privacyAccepted,
    newsletter,
    paymentMethod,
    appliedVoucher,
    isPayPalConfigured,
    voucherForms,
    normaliseVoucherDetailsForSubmit,
    clearSelections,
    shippingCostSetting,
    steps.length,
    router
  ]);

  const handlePrimaryAction = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStepError(null);

      if (activeStepId === "participants") {
        if (!validateParticipants()) {
          return;
        }
        moveToStep(activeStepIndex + 1);
        return;
      }

      if (activeStepId === "gutscheine") {
        if (!validateVoucherDetails()) {
          return;
        }
        moveToStep(activeStepIndex + 1);
        return;
      }

      if (activeStepId === "billing") {
        if (!validateBilling()) {
          return;
        }
        moveToStep(activeStepIndex + 1);
        return;
      }

      if (activeStepId === "overview") {
        let hasError = false;
        if (!agbAccepted) {
          setAgbError(true);
          setStepError("Bitte bestätige die Allgemeinen Geschäftsbedingungen.");
          hasError = true;
        } else {
          setAgbError(false);
        }
        if (!privacyAccepted) {
          setPrivacyError(true);
          if (!hasError) {
            setStepError("Bitte bestätige den Datenschutzhinweis.");
          }
          hasError = true;
        } else {
          setPrivacyError(false);
        }
        if (hasError) {
          return;
        }
        moveToStep(activeStepIndex + 1);
        return;
      }

      if (activeStepId === "payment") {
        if (!validatePayment()) {
          return;
        }
        if (isPayPalSelected) {
          setStepError("Bitte schließe die Zahlung über PayPal ab.");
          return;
        }
        handleSubmitOrder();
      }
    },
    [
      activeStepId,
      activeStepIndex,
      handleSubmitOrder,
      moveToStep,
      isPayPalSelected,
      validateBilling,
      validateVoucherDetails,
      validateParticipants,
      agbAccepted,
      privacyAccepted,
      validatePayment
    ]
  );

  const handleVoucherCheck = useCallback(async () => {
    const code = voucherInput.trim();
    if (!code) {
      setVoucherMessage("Bitte gib einen Rabatt- oder Gutscheincode ein.");
      return;
    }
    if (appliedVoucher && appliedVoucher.code.toLowerCase() === code.toLowerCase()) {
      setVoucherMessage("Dieser Gutscheincode ist bereits angewendet.");
      return;
    }

    const subtotal = summaryItems.reduce((acc, item) => acc + (item.subtotal ?? 0), 0);
    if (subtotal <= 0) {
      setVoucherMessage("Der Warenkorb enthält keine kostenpflichtigen Positionen.");
      return;
    }

    const netto = summaryItems.reduce((acc, item) => acc + (item.netto ?? item.subtotal ?? 0), 0);
    const steuer = Math.max(0, subtotal - netto);

    setVoucherChecking(true);
    setVoucherMessage(null);
    const lookup = await fetchVoucherByCode(code, { brutto: subtotal, netto, steuer });
    setVoucherChecking(false);

    if (!lookup) {
      setVoucherMessage("Der eingegebene Code ist ungültig oder wurde nicht gefunden.");
      return;
    }

    const usableAmount = Math.max(0, Math.min(lookup.amount, subtotal));
    if (usableAmount <= 0) {
      setVoucherMessage("Der Gutschein enthält aktuell kein verfügbares Guthaben.");
      return;
    }
    const remaining = Math.max(0, lookup.remaining ?? 0);

    setAppliedVoucher({
      code: lookup.code,
      amount: usableAmount,
      remaining,
      description: lookup.description ?? lookup.name ?? null
    });
    setVoucherInput(lookup.code.toUpperCase());
    setVoucherMessage(
      remaining > 0
        ? `Gutschein angewendet. Verbleibendes Guthaben: ${formatCurrency(remaining)}.`
        : lookup.typ === "prozent"
          ? "Rabattcode angewendet."
          : "Gutschein vollständig angewendet."
    );
  }, [appliedVoucher, summaryItems, voucherInput]);

  const primaryActionLabel = useMemo(() => {
    switch (activeStepId) {
      case "participants":
        return hasVoucherSelection ? "Weiter zu Gutscheinen" : "Weiter zur Rechnungsadresse";
      case "gutscheine":
        return "Weiter zur Rechnungsadresse";
      case "billing":
        return "Weiter zur Bestellübersicht";
      case "overview":
        return "Weiter zur Zahlung";
      case "payment":
        return submissionState === "submitting" ? "Bitte warten ..." : "Jetzt kostenpflichtig bestellen";
      default:
        return "Weiter";
    }
  }, [activeStepId, submissionState, hasVoucherSelection]);

  const showPrimaryButton = !(activeStepId === "payment" && isPayPalSelected);

  const renderParticipantsStep = () => {
    if (participantGroupsWithMeta.length === 0) {
      return (
        <CheckoutStepCard>
          <div className="py-6 text-sm text-base-content/70">
            Es sind aktuell keine Seminare im Warenkorb.
          </div>
        </CheckoutStepCard>
      );
    }

    return (
      <CheckoutStepCard withDividers contentClassName="space-y-0">
        {participantGroupsWithMeta.map(({ seminar, group }) => (
          <div key={group.selectionId} className="py-6 first:pt-0 last:pb-0">
            <h3 className="heading-ui">{seminar.seminarTitle}</h3>
            <div className="mt-6 space-y-6">
              {group.participants.map((participant, index) => {
                const errorState = group.errors[index] ?? createParticipantErrorState();
                const specialNeedsInputId = `${group.selectionId}-participant-${index}-special-needs`;
                return (
                  <div key={`${group.selectionId}-${index}`} className="rounded-2xl border ui-border bg-base-100 p-5">
                    <p className="text-sm font-semibold text-base-content">Teilnehmer {index + 1}</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="form-control">
                        <span className={`label-text text-sm font-medium ${errorState.firstName ? "text-error" : ""}`}>
                          Vorname *
                        </span>
                        <input
                          type="text"
                          className={`input input-bordered ${errorState.firstName ? "input-error" : ""}`}
                          value={participant.firstName}
                          onChange={(event) =>
                            handleParticipantChange(group.selectionId, index, "firstName", event.target.value)
                          }
                          required
                        />
                        {errorState.firstName ? (
                          <span className="mt-1 text-xs text-error">Vorname ist erforderlich.</span>
                        ) : null}
                      </label>
                      <label className="form-control">
                        <span className={`label-text text-sm font-medium ${errorState.lastName ? "text-error" : ""}`}>
                          Nachname *
                        </span>
                        <input
                          type="text"
                          className={`input input-bordered ${errorState.lastName ? "input-error" : ""}`}
                          value={participant.lastName}
                          onChange={(event) =>
                            handleParticipantChange(group.selectionId, index, "lastName", event.target.value)
                          }
                          required
                        />
                        {errorState.lastName ? (
                          <span className="mt-1 text-xs text-error">Nachname ist erforderlich.</span>
                        ) : null}
                      </label>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="form-control">
                        <span className="label-text text-sm font-medium">E-Mail</span>
                        <input
                          type="email"
                          className="input input-bordered"
                          value={participant.email}
                          onChange={(event) =>
                            handleParticipantChange(group.selectionId, index, "email", event.target.value)
                          }
                          placeholder="name@example.com"
                        />
                      </label>
                      <label className="form-control">
                        <span className="label-text text-sm font-medium">WSET Candidate Number</span>
                        <input
                          type="text"
                          className="input input-bordered"
                          value={participant.wsetNumber}
                          onChange={(event) =>
                            handleParticipantChange(group.selectionId, index, "wsetNumber", event.target.value)
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                    <div className="mt-4">
                      <label htmlFor={specialNeedsInputId} className="block text-sm font-medium text-base-content">
                        Besondere Bedürfnisse
                      </label>
                      <textarea
                        id={specialNeedsInputId}
                        className="textarea textarea-bordered mt-2 w-full min-h-[120px]"
                        value={participant.specialNeeds}
                        onChange={(event) =>
                          handleParticipantChange(group.selectionId, index, "specialNeeds", event.target.value)
                        }
                        placeholder="Allergien, Barrierefreiheit oder andere Hinweise für unser Team"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CheckoutStepCard>
    );
  };

  const renderVoucherStep = () => {
    if (voucherItems.length === 0) {
      return (
        <CheckoutStepCard>
          <div className="py-6 text-sm text-base-content/70">
            Es sind aktuell keine Gutscheine im Warenkorb.
          </div>
        </CheckoutStepCard>
      );
    }

    const renderLabelClass = (hasError: boolean) =>
      `block text-sm font-medium ${hasError ? "text-error" : "text-base-content"}`;
    const renderInputClass = (hasError: boolean) => `input input-bordered mt-2 w-full ${hasError ? "input-error" : ""}`;

    return (
      <CheckoutStepCard withDividers contentClassName="space-y-0">
        {voucherItems.map((item) => {
          const form = voucherForms[item.key] ?? createVoucherFormValue();
          const errors = voucherFormErrors[item.key] ?? {};
          const isPhysisch = form.versandArt === "physisch";

          return (
            <div key={item.key} className="py-6 first:pt-0 last:pb-0">
              <h3 className="heading-ui">
                {item.title}
                {item.quantity > 1 ? ` (x${item.quantity})` : ""}
              </h3>
              {item.subtitle ? (
                <p className="mt-1 text-sm text-base-content/70">{item.subtitle}</p>
              ) : null}

              <div className="mt-6 space-y-6">
                <div>
                  <span className="text-sm font-medium text-base-content">Versandart *</span>
                  <div role="tablist" aria-label="Versandart" className="mt-3 flex gap-6 ui-border-bottom">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={form.versandArt === "digital"}
                      className={`relative pb-3 text-sm font-semibold ${
                        form.versandArt === "digital" ? "text-primary" : "text-base-content/70"
                      }`}
                      onClick={() => handleVoucherVersandArtChange(item.key, "digital")}
                    >
                      Per E-Mail
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                          form.versandArt === "digital" ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={form.versandArt === "physisch"}
                      className={`relative pb-3 text-sm font-semibold ${
                        form.versandArt === "physisch" ? "text-primary" : "text-base-content/70"
                      }`}
                      onClick={() => handleVoucherVersandArtChange(item.key, "physisch")}
                    >
                      Per Post
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                          form.versandArt === "physisch" ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </button>
                  </div>
                  {isPhysisch && voucherState?.shippingCost ? (
                    <p className="mt-2 text-sm text-base-content/60">
                      Es fallen Versandkosten in Höhe von {formatCurrency(voucherState.shippingCost)} an.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`voucher-${item.key}-vorname`}
                      className={renderLabelClass(Boolean(errors.empfaengerVorname))}
                    >
                      Vorname der beschenkten Person *
                    </label>
                    <input
                      id={`voucher-${item.key}-vorname`}
                      type="text"
                      className={renderInputClass(Boolean(errors.empfaengerVorname))}
                      value={form.empfaengerVorname}
                      onChange={(event) => handleVoucherFieldChange(item.key, "empfaengerVorname", event.target.value)}
                      required
                    />
                    {errors.empfaengerVorname ? (
                      <p className="mt-1 text-xs text-error">{errors.empfaengerVorname}</p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor={`voucher-${item.key}-nachname`}
                      className={renderLabelClass(Boolean(errors.empfaengerNachname))}
                    >
                      Nachname der beschenkten Person *
                    </label>
                    <input
                      id={`voucher-${item.key}-nachname`}
                      type="text"
                      className={renderInputClass(Boolean(errors.empfaengerNachname))}
                      value={form.empfaengerNachname}
                      onChange={(event) => handleVoucherFieldChange(item.key, "empfaengerNachname", event.target.value)}
                      required
                    />
                    {errors.empfaengerNachname ? (
                      <p className="mt-1 text-xs text-error">{errors.empfaengerNachname}</p>
                    ) : null}
                  </div>
                </div>

                {form.versandArt === "digital" ? (
                  <div>
                    <label
                      htmlFor={`voucher-${item.key}-email`}
                      className={renderLabelClass(Boolean(errors.empfaengerEmail))}
                    >
                      E-Mail für den Versand (optional)
                    </label>
                    <input
                      id={`voucher-${item.key}-email`}
                      type="email"
                      className={renderInputClass(Boolean(errors.empfaengerEmail))}
                      value={form.empfaengerEmail}
                      onChange={(event) => handleVoucherFieldChange(item.key, "empfaengerEmail", event.target.value)}
                      placeholder="name@example.com"
                    />
                    {errors.empfaengerEmail ? (
                      <p className="mt-1 text-xs text-error">{errors.empfaengerEmail}</p>
                    ) : (
                      <p className="mt-1 text-xs text-base-content/60">
                        Falls du eine E-Mail-Adresse angibst, senden wir den Gutschein automatisch dorthin.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor={`voucher-${item.key}-strasse`}
                        className={renderLabelClass(Boolean(errors.strasse))}
                      >
                        Straße und Hausnummer *
                      </label>
                      <input
                        id={`voucher-${item.key}-strasse`}
                        type="text"
                        className={renderInputClass(Boolean(errors.strasse))}
                        value={form.strasse}
                        onChange={(event) => handleVoucherFieldChange(item.key, "strasse", event.target.value)}
                        autoComplete="street-address"
                        required
                      />
                      {errors.strasse ? (
                        <p className="mt-1 text-xs text-error">{errors.strasse}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor={`voucher-${item.key}-adresszusatz`} className="block text-sm font-medium text-base-content">
                        Adresszusatz
                      </label>
                      <input
                        id={`voucher-${item.key}-adresszusatz`}
                        type="text"
                        className="input input-bordered mt-2 w-full"
                        value={form.adresszusatz}
                        onChange={(event) => handleVoucherFieldChange(item.key, "adresszusatz", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`voucher-${item.key}-plz`}
                          className={renderLabelClass(Boolean(errors.plz))}
                        >
                          PLZ *
                        </label>
                        <input
                          id={`voucher-${item.key}-plz`}
                          type="text"
                          className={renderInputClass(Boolean(errors.plz))}
                          value={form.plz}
                          onChange={(event) => handleVoucherFieldChange(item.key, "plz", event.target.value)}
                          autoComplete="postal-code"
                          required
                        />
                        {errors.plz ? <p className="mt-1 text-xs text-error">{errors.plz}</p> : null}
                      </div>
                      <div>
                        <label
                          htmlFor={`voucher-${item.key}-stadt`}
                          className={renderLabelClass(Boolean(errors.stadt))}
                        >
                          Stadt *
                        </label>
                        <input
                          id={`voucher-${item.key}-stadt`}
                          type="text"
                          className={renderInputClass(Boolean(errors.stadt))}
                          value={form.stadt}
                          onChange={(event) => handleVoucherFieldChange(item.key, "stadt", event.target.value)}
                          autoComplete="address-level2"
                          required
                        />
                        {errors.stadt ? <p className="mt-1 text-xs text-error">{errors.stadt}</p> : null}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor={`voucher-${item.key}-land`}
                        className={renderLabelClass(Boolean(errors.land))}
                      >
                        Land *
                      </label>
                      <input
                        id={`voucher-${item.key}-land`}
                        type="text"
                        className={renderInputClass(Boolean(errors.land))}
                        value={form.land}
                        onChange={(event) => handleVoucherFieldChange(item.key, "land", event.target.value)}
                        autoComplete="country-name"
                        required
                      />
                      {errors.land ? <p className="mt-1 text-xs text-error">{errors.land}</p> : null}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`voucher-${item.key}-lieferdatum`}
                      className={renderLabelClass(Boolean(errors.lieferDatum))}
                    >
                      Gewünschte Zustellung
                      <span className="text-base-content/60"> (optional)</span>
                    </label>
                    <input
                      id={`voucher-${item.key}-lieferdatum`}
                      type="date"
                      className={renderInputClass(Boolean(errors.lieferDatum))}
                      value={form.lieferDatum}
                      onChange={(event) => handleVoucherFieldChange(item.key, "lieferDatum", event.target.value)}
                    />
                    {errors.lieferDatum ? (
                      <p className="mt-1 text-xs text-error">{errors.lieferDatum}</p>
                    ) : (
                      <p className="mt-1 text-xs text-base-content/60">
                        Wir berücksichtigen den Termin, soweit möglich.
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor={`voucher-${item.key}-nachricht`}
                      className="block text-sm font-medium text-base-content"
                    >
                      Persönliche Nachricht
                      <span className="text-base-content/60"> (optional)</span>
                    </label>
                    <textarea
                      id={`voucher-${item.key}-nachricht`}
                      className="textarea textarea-bordered mt-2 w-full min-h-[120px]"
                      value={form.persoenlicheNachricht}
                      onChange={(event) =>
                        handleVoucherFieldChange(item.key, "persoenlicheNachricht", event.target.value)
                      }
                      placeholder="Deine Glückwünsche oder Hinweise an die beschenkte Person"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CheckoutStepCard>
    );
  };

  const renderBillingStep = () => {
    const isCompany = billing.type === "firma";

    const renderTextField = (
      name: Exclude<BillingFieldName, "type">,
      {
        label,
        type = "text",
        required = false,
        placeholder,
        span = 1,
        error,
        autoComplete
      }: {
        label: string;
        type?: string;
        required?: boolean;
        placeholder?: string;
        span?: 1 | 2;
        error?: string | null;
        autoComplete?: string;
      }
    ) => {
      const inputId = `billing-${name}`;
      const labelClass = `block text-sm font-medium ${error ? "text-error" : "text-base-content"}`;
      const inputClass = `input input-bordered mt-2 w-full ${error ? "input-error" : ""}`;

      return (
        <div className={span === 2 ? "md:col-span-2" : ""}>
          <label htmlFor={inputId} className={labelClass}>
            {label}
            {required ? " *" : ""}
          </label>
          <input
            id={inputId}
            type={type}
            className={inputClass}
            value={billing[name] as string}
            onChange={(event) => handleBillingChange(name, event.target.value)}
            required={required}
            placeholder={placeholder}
            autoComplete={autoComplete}
          />
          {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
        </div>
      );
    };

    return (
      <CheckoutStepCard contentClassName="space-y-6">
        <div>
          <div role="tablist" aria-label="Rechnungstyp" className="flex gap-6 ui-border-bottom">
            <button
              type="button"
              role="tab"
              aria-selected={!isCompany}
              className={`relative pb-3 text-sm font-semibold ${
                !isCompany ? "text-primary" : "text-base-content/70"
              }`}
              onClick={() => handleBillingTypeChange("privat")}
            >
              Privat
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                  !isCompany ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isCompany}
              className={`relative pb-3 text-sm font-semibold ${
                isCompany ? "text-primary" : "text-base-content/70"
              }`}
              onClick={() => handleBillingTypeChange("firma")}
            >
              Geschäftlich
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                  isCompany ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          </div>
        </div>

        {isCompany ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {renderTextField("companyName", {
                label: "Firmenname",
                required: true,
                error: billingErrors.companyName,
                span: 2
              })}
              {renderTextField("invoiceEmail", {
                label: "Rechnungs-E-Mail",
                type: "email",
                required: true,
                error: billingErrors.invoiceEmail,
                autoComplete: "email"
              })}
              {renderTextField("vatId", {
                label: "Umsatzsteuer-ID",
                placeholder: "Optional"
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextField("contactFirstName", {
              label: isCompany ? "Ansprechpartner Vorname" : "Vorname",
              required: true,
              error: billingErrors.contactFirstName
            })}
            {renderTextField("contactLastName", {
              label: isCompany ? "Ansprechpartner Nachname" : "Nachname",
              required: true,
              error: billingErrors.contactLastName
            })}
            {renderTextField("contactEmail", {
              label: "E-Mail",
              type: "email",
              required: true,
              error: billingErrors.contactEmail,
              autoComplete: "email"
            })}
            {renderTextField("phone", {
              label: "Telefon",
              type: "tel",
              required: true,
              error: billingErrors.phone,
              autoComplete: "tel"
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderTextField("street", {
              label: "Straße und Hausnummer",
              required: true,
              error: billingErrors.street,
              span: 2,
              autoComplete: "street-address"
            })}
            {renderTextField("zip", {
              label: "Postleitzahl",
              required: true,
              error: billingErrors.zip,
              autoComplete: "postal-code"
            })}
            {renderTextField("city", {
              label: "Stadt",
              required: true,
              error: billingErrors.city,
              autoComplete: "address-level2"
            })}
            {renderTextField("country", {
              label: "Land",
              required: true,
              error: billingErrors.country,
              span: 2,
              autoComplete: "country-name"
            })}
          </div>
        </div>
      </CheckoutStepCard>
    );
  };

const renderOverviewStep = () => {
  const agreementsBoxHasError = agbError || privacyError;
  const agreementBorderClass = agreementsBoxHasError ? "border-error" : "ui-border";

  return (
    <CheckoutStepCard withDividers contentClassName="space-y-0">
      {hasSeminarSelection ? (
        <div className="py-6 first:pt-0 last:pb-0">
          <div className="rounded-2xl border ui-border bg-base-100 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="heading-ui">Teilnehmerdaten</h3>
              <button type="button" className="btn btn-link btn-sm px-0" onClick={() => goToStep("participants")}>
                Bearbeiten
              </button>
            </div>
            <div className="mt-4 space-y-6 text-sm text-base-content/80">
              {participantGroupsWithMeta.map(({ seminar, group }, seminarIndex) => (
                <div key={group.selectionId} className={seminarIndex === 0 ? "" : "ui-border-top pt-4"}>
                  <p className="text-base font-semibold text-base-content">{seminar.seminarTitle}</p>
                  {seminar.seminarDescription ? (
                    <p className="mt-1 text-sm text-base-content/70">{seminar.seminarDescription}</p>
                  ) : null}
                  <div className="mt-2 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Termine</span>
                    {seminar.terminSlots.length > 0 ? (
                      <ul className="space-y-1 text-sm text-base-content/70">
                        {seminar.terminSlots.map((slot, slotIndex) => (
                          <li key={`${group.selectionId}-termin-${slotIndex}`}>{slot}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-base-content/70">{seminar.terminLabel}</p>
                    )}
                  </div>
                  <div className="mt-6 space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Teilnehmer</span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.participants.map((participant, index) => (
                        <div
                          key={`${group.selectionId}-${index}`}
                          className="rounded-xl border ui-border bg-base-100/80 p-4 space-y-2"
                        >
                          <p className="text-sm font-semibold text-base-content">
                            {participant.firstName || "—"} {participant.lastName || "—"}
                          </p>
                          {participant.email ? (
                            <p className="text-sm text-base-content/70">{participant.email}</p>
                          ) : null}
                          {participant.wsetNumber ? (
                            <p className="text-sm text-base-content/70">WSET Candidate Number: {participant.wsetNumber}</p>
                          ) : null}
                          {participant.specialNeeds ? (
                            <p className="text-sm text-base-content/70">Besondere Bedürfnisse: {participant.specialNeeds}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="py-6 first:pt-0 last:pb-0">
        <div className="rounded-2xl border ui-border bg-base-100 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="heading-ui">Rechnungsadresse</h3>
            <button type="button" className="btn btn-link btn-sm px-0" onClick={() => goToStep("billing")}>
              Bearbeiten
            </button>
          </div>
          <div className="mt-4 space-y-4 text-sm text-base-content/80">
            <div className="space-y-2">
              <p className="text-base font-semibold text-base-content">{billing.companyName || billing.contactFirstName}</p>
              <p>
                {billing.street}
                <br />
                {billing.zip} {billing.city}
              </p>
              <p className="text-base-content/70">{billing.country}</p>
              <div className="mt-2 space-y-1 text-base-content/70">
                <p>E-Mail: {billing.contactEmail}</p>
                {billing.type === "firma" && billing.invoiceEmail ? <p>Rechnungs-E-Mail: {billing.invoiceEmail}</p> : null}
                <p>Telefon: {billing.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6 first:pt-0 last:pb-0">
        <div className="rounded-2xl border ui-border bg-base-100 p-5">
          <h3 className="heading-ui">Rabatt / Gutscheincode</h3>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              className="input input-bordered md:flex-1"
              placeholder="Code eingeben"
              value={voucherInput}
              onChange={(event) => setVoucherInput(event.target.value)}
            />
            <div className="flex items-center gap-2">
              {appliedVoucher ? (
                <button
                  type="button"
                  className="btn ui-border bg-base-200 text-base-content hover:bg-base-300 gap-2"
                  onClick={handleRemoveVoucher}
                  aria-label="Gutscheincode entfernen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.154l.73 11.675A2 2 0 0 0 7.878 20H16.12a2 2 0 0 0 1.994-1.325L18.846 7H19a1 1 0 1 0 0-2h-2.382l-.724-1.447A1 1 0 0 0 15 3H9Zm.118 4-.667 11h7.098l-.667-11H9.118ZM11 9a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0V9Z" />
                  </svg>
                  Code entfernen
                </button>
              ) : (
                <button
                  type="button"
                  className={`btn ui-border bg-base-200 text-base-content hover:bg-base-300 ${voucherChecking ? "loading" : ""}`}
                  onClick={handleVoucherCheck}
                  disabled={voucherChecking}
                >
                  Code prüfen
                </button>
              )}
            </div>
          </div>
          {voucherMessage ? <p className="mt-3 text-sm text-base-content/70">{voucherMessage}</p> : null}
          {appliedVoucher ? (
            <div className="mt-4 rounded-xl border border-primary bg-primary/5 p-4 text-sm text-base-content">
              <p className="font-semibold">Rabattcode angewendet: {appliedVoucher.code.toUpperCase()}</p>
              <p className="mt-1 text-base-content/70">
                Abzug: {formatCurrency(appliedVoucher.amount)}
                {appliedVoucher.remaining != null ? ` · Restguthaben: ${formatCurrency(appliedVoucher.remaining)}` : null}
              </p>
              {appliedVoucher.description ? (
                <p className="mt-1 text-base-content/60">{appliedVoucher.description}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="py-6 first:pt-0 last:pb-0">
        <div className={`rounded-2xl border bg-base-100 p-5 ${agreementBorderClass}`}>
          <h3 className="heading-ui">Rechtliche Hinweise</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label w-full cursor-pointer items-start gap-3 whitespace-normal">
                <input
                  type="checkbox"
                  className={`checkbox ${agbError ? "border-error outline outline-1 outline-error" : ""}`}
                  checked={agbAccepted}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAgbAccepted(checked);
                    if (checked) {
                      setAgbError(false);
                      if (privacyAccepted) {
                        setStepError(null);
                      }
                    }
                  }}
                />
                <span
                  className={`label-text flex-1 min-w-0 break-words text-sm leading-relaxed ${
                    agbError ? "text-error" : "text-base-content"
                  }`}
                >
                  Ich akzeptiere die AGB.*
                </span>
              </label>
              {agbError ? <p className="pl-9 text-xs text-error">Bitte bestätige die AGB.</p> : null}
            </div>
            <div>
              <label className="label w-full cursor-pointer items-start gap-3 whitespace-normal">
                <input
                  type="checkbox"
                  className={`checkbox ${privacyError ? "border-error outline outline-1 outline-error" : ""}`}
                  checked={privacyAccepted}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setPrivacyAccepted(checked);
                    if (checked) {
                      setPrivacyError(false);
                      if (agbAccepted) {
                        setStepError(null);
                      }
                    }
                  }}
                />
                <span
                  className={`label-text flex-1 min-w-0 break-words text-sm leading-relaxed ${
                    privacyError ? "text-error" : "text-base-content"
                  }`}
                >
                  Ich stimme dem Datenschutz zu.*
                </span>
              </label>
              {privacyError ? <p className="pl-9 text-xs text-error">Bitte bestätige den Datenschutz.</p> : null}
            </div>
            <div>
              <label className="label w-full cursor-pointer items-start gap-3 whitespace-normal">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={newsletter}
                  onChange={(event) => setNewsletter(event.target.checked)}
                />
                <span className="label-text flex-1 min-w-0 break-words text-sm leading-relaxed text-base-content">
                  Newsletter (optional).
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </CheckoutStepCard>
  );
};

const renderPaymentStep = () => {
  const currentPayPalOption =
    isPayPalConfigured && paymentMethod !== "rechnung"
      ? PAYPAL_OPTION_CONFIG[paymentMethod as Exclude<PaymentMethod, "rechnung">]
      : null;
  const paypalDisabled = totals.total <= 0 || submissionState === "submitting";

  return (
    <CheckoutStepCard withDividers contentClassName="space-y-0">
      <div className="py-6 first:pt-0 last:pb-0">
        <div className="divide-y divide-base-200">
          {PAYMENT_OPTIONS.map((option) => {
            const optionDisabled = option.value !== "rechnung" && !isPayPalConfigured;
            const isChecked = paymentMethod === option.value;
            return (
              <label
                key={option.value}
                className={`flex items-start gap-4 py-4 first:pt-0 last:pb-0 ${optionDisabled ? "opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  className="radio mt-1"
                  name="paymentMethod"
                  value={option.value}
                  checked={isChecked}
                  disabled={optionDisabled}
                  onChange={() => {
                    if (!optionDisabled) {
                      setPaymentMethod(option.value);
                    }
                  }}
                />
                <div className="space-y-1">
                  <p className={`font-semibold ${isChecked ? "text-primary" : "text-base-content"}`}>{option.label}</p>
                  {option.description ? (
                    <p className="text-sm text-base-content/70">{option.description}</p>
                  ) : null}
                  {optionDisabled ? (
                    <p className="text-xs text-warning">
                      PayPal ist noch nicht konfiguriert. Bitte hinterlege die Umgebungsvariable <code className="mx-1">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>.
                    </p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {currentPayPalOption ? (
        <div className="py-6 first:pt-0 last:pb-0">
          <div className="rounded-2xl border border-primary/50 bg-primary/5 p-5">
            <h3 className="heading-ui">{currentPayPalOption.title}</h3>
            <p className="mt-1 text-sm text-base-content/70">{currentPayPalOption.helper}</p>
            <div className="mt-4">
              <PayPalButtons
                amount={totals.total}
                disabled={!agbAccepted || !privacyAccepted || paypalDisabled}
                label={currentPayPalOption.buttonLabel}
                fundingSource={currentPayPalOption.fundingSource}
                onApprove={async ({ orderId, captureId }) => {
                  await handleSubmitOrder({ orderId, captureId });
                }}
                onError={(message) => {
                  setPaypalError(message);
                }}
              />
            </div>
            <p className="mt-3 text-xs text-base-content/60">
              Die Zahlungsabwicklung erfolgt vollständig über PayPal. Nach dem Klick wirst du zum PayPal-Fenster weitergeleitet.
            </p>
            {paypalError ? <p className="mt-3 text-sm text-error">{paypalError}</p> : null}
          </div>
        </div>
      ) : !isPayPalConfigured ? (
        <div className="py-6 first:pt-0 last:pb-0">
          <div className="rounded-2xl border border-warning bg-warning/10 p-5 text-sm text-warning">
            PayPal-Zahlungen stehen aktuell nicht zur Verfügung. Bitte ergänze die Umgebungsvariable <code className="mx-1">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>,
            um PayPal, Lastschrift oder Kreditkarte zu aktivieren.
          </div>
        </div>
      ) : null}
    </CheckoutStepCard>
  );
};


  const renderConfirmationStep = () => {
    const derivedPayPalKey: Exclude<PaymentMethod, "rechnung"> | null =
      submittedPaymentMethod && submittedPaymentMethod !== "rechnung"
        ? submittedPaymentMethod
        : orderInformation?.zahlungsmethode === "paypal"
          ? "paypal"
          : null;
    const confirmationMessage =
      derivedPayPalKey
        ? PAYPAL_CONFIRMATION_MESSAGE[derivedPayPalKey]
        : orderInformation?.zahlungsmethode === "rechnung"
          ? "Du erhältst deine Rechnung inklusive Zahlungsinformationen per E-Mail."
          : null;
    const invoiceLink = orderInformation?.downloads?.rechnung ?? null;
    const invoiceStatusMessage = invoicePolling
      ? "Wir synchronisieren deine Rechnung. Das kann bis zu einer Minute dauern."
      : invoicePollingStarted
        ? "Die Rechnung ist noch nicht verfügbar. Bitte lade diese Seite in Kürze erneut oder prüfe deine Bestellübersicht."
        : "Die Rechnung wird gleich bereitgestellt.";
    const confirmationTotals = orderInformation?.totals ?? null;
    const confirmationShipping = confirmationTotals?.versandkosten ?? 0;
    const confirmationSubtotal = confirmationTotals
      ? Math.max(
          0,
          (confirmationTotals.brutto ?? 0) + (confirmationTotals.gutschein ?? 0) - (confirmationTotals.versandkosten ?? 0)
        )
      : null;

    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-6 py-12 md:px-8">
        <div className="max-w-3xl rounded-2xl border border-base-200 bg-base-100 p-10 text-center shadow-sm">
          <h2 className="heading-section">Vielen Dank für deine Bestellung!</h2>
          <p className="mt-4 text-base text-base-content/80">
            {orderInformation?.bestellnummer
              ? `Deine Bestellnummer lautet ${orderInformation.bestellnummer}.`
              : "Du erhältst in Kürze eine Bestätigung per E-Mail."}
          </p>
          {confirmationMessage ? (
            <p className="mt-2 text-sm text-base-content/70">{confirmationMessage}</p>
          ) : null}
          <p className="mt-2 text-sm text-base-content/60">
            Die Bestätigung bleibt auch bei einem erneuten Aufruf dieser Seite verfügbar.
          </p>
          {invoiceLink ? (
            <div className="mt-6 flex justify-center">
              <a href={invoiceLink} className="btn btn-primary" target="_blank" rel="noreferrer">
                Rechnung herunterladen
              </a>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3">
              <button type="button" className="btn btn-outline btn-disabled flex items-center gap-2" disabled>
                {invoicePolling ? (
                  <>
                    <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                    Rechnung wird vorbereitet …
                  </>
                ) : (
                  "Rechnung wird vorbereitet …"
                )}
              </button>
              <p className="text-xs text-base-content/60 text-center">{invoiceStatusMessage}</p>
            </div>
          )}
          {confirmationTotals ? (
            <dl className="mt-8 space-y-2 text-sm text-base-content/80">
              {confirmationSubtotal != null && confirmationSubtotal > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  <dt className="font-medium">Zwischensumme</dt>
                  <dd>{formatCurrency(confirmationSubtotal)}</dd>
                </div>
              ) : null}
              {confirmationShipping > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  <dt className="font-medium">Versand</dt>
                  <dd>{formatCurrency(confirmationShipping)}</dd>
                </div>
              ) : null}
              {confirmationTotals.gutschein ? (
                <div className="flex items-center justify-center gap-3 text-error">
                  <dt className="font-medium">Gutschein</dt>
                  <dd>-{formatCurrency(confirmationTotals.gutschein)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-center gap-3">
                <dt className="font-medium">Steuern</dt>
                <dd>{formatCurrency(confirmationTotals.steuer ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-center gap-3 text-base font-semibold">
                <dt>Gesamtsumme</dt>
                <dd>{formatCurrency(confirmationTotals.brutto ?? 0)}</dd>
              </div>
            </dl>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-primary" onClick={() => router.push("/")}>
              Zurück zur Startseite
            </button>
            <button type="button" className="btn btn-outline" onClick={() => router.push("/konto/bestellungen")}>
              Meine Bestellungen ansehen
            </button>
          </div>
        </div>
      </div>
    );
  };

  const backendTotals = submissionState === "success" && orderInformation?.totals ? orderInformation.totals : null;
  const derivedShipping = backendTotals ? backendTotals.versandkosten ?? 0 : totals.shipping;
  const derivedSubtotal = backendTotals
    ? Math.max(0, (backendTotals.brutto ?? 0) + (backendTotals.gutschein ?? 0) - derivedShipping)
    : totals.subtotal;
  const derivedDiscount = backendTotals ? backendTotals.gutschein ?? 0 : appliedVoucher?.amount ?? 0;
  const derivedTax = backendTotals ? backendTotals.steuer ?? 0 : totals.tax;
  const derivedTotal = backendTotals ? backendTotals.brutto ?? 0 : totals.total;
  const discountLabel = appliedVoucher
    ? `Rabatt (${appliedVoucher.code.toUpperCase()})`
    : backendTotals && derivedDiscount > 0
      ? "Gutschein"
      : "Rabatt";

  const renderSummaryAside = () => (
    <aside className="overflow-hidden rounded-2xl bg-base-100 shadow-sm">
      <div className="px-6 py-8 space-y-6">
        <div>
          <h2 className="heading-card">Deine Bestellung</h2>
        </div>

        <div className="ui-border-top" aria-hidden="true" />

        {summaryItems.length > 0 ? (
          <ul className="space-y-4">
            {summaryItems.map((item, index) => (
              <li
                key={item.id}
                className={`space-y-2 ${index === 0 ? "" : "pt-4 ui-border-top"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-base-content">{item.title}</p>
                    {item.description ? (
                      <p className="text-sm text-base-content/70">{item.description}</p>
                    ) : null}
                    {item.details && item.details.length > 0 ? (
                      <ul className="space-y-1 text-sm text-base-content/60">
                        {item.details.map((detail, detailIndex) => (
                          <li key={`${item.id}-detail-${detailIndex}`}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-base-content">
                    {formatCurrency(item.subtotal ?? null)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-base-content/60">
            Keine Artikel ausgewählt. Bitte füge ein Seminar, Produkt oder einen Gutschein hinzu.
          </p>
        )}

        <div className="ui-border-top" aria-hidden="true" />

        <dl className="space-y-3 text-sm text-base-content">
          <div className="flex items-center justify-between">
            <dt>Zwischensumme</dt>
            <dd>{formatCurrency(derivedSubtotal)}</dd>
          </div>
          {derivedShipping > 0 ? (
            <div className="flex items-center justify-between">
              <dt>Versand</dt>
              <dd>{formatCurrency(derivedShipping)}</dd>
            </div>
          ) : null}
          {derivedDiscount > 0 ? (
            <div className="flex items-center justify-between text-error">
              <dt>{discountLabel}</dt>
              <dd>-{formatCurrency(derivedDiscount)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt>Steuern</dt>
            <dd>{formatCurrency(derivedTax)}</dd>
          </div>
          <div className="flex items-center justify-between text-base font-semibold">
            <dt>Gesamtsumme</dt>
            <dd>{formatCurrency(derivedTotal)}</dd>
          </div>
        </dl>
      </div>
    </aside>
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

  if (!hasSelections && submissionState !== "success") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center md:px-8">
        <h1 className="heading-section">Dein Warenkorb ist leer</h1>
        <p className="mt-4 text-base text-base-content/70">
          Füge zunächst ein Seminar oder Produkt hinzu, um mit der Bestellung fortzufahren.
        </p>
      </div>
    );
  }

  if (activeStepId === "confirmation" && submissionState === "success") {
    return renderConfirmationStep();
  }

  const currentStepLabel =
    activeStepIndex >= 0 && activeStepIndex < steps.length ? steps[activeStepIndex].label : "Checkout";
  const currentStepDescription = STEP_DESCRIPTIONS[activeStepId];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-8">
      <h1>{currentStepLabel}</h1>
      {currentStepDescription ? (
        <p className="mt-4 text-lg leading-relaxed text-base-content/90 md:max-w-3xl">{currentStepDescription}</p>
      ) : null}
      {loadError ? (
        <div className="mt-6 rounded-2xl border border-error bg-error/10 p-4 text-error">{loadError}</div>
      ) : null}

      <CheckoutProgress
        steps={steps}
        activeStepId={activeStepId}
        activeStepIndex={activeStepIndex}
        furthestStepIndex={furthestStepIndex}
        onStepClick={goToStep}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <form ref={formRef} className="space-y-8" onSubmit={handlePrimaryAction}>
          {activeStepId === "participants" && renderParticipantsStep()}
          {activeStepId === "gutscheine" && renderVoucherStep()}
          {activeStepId === "billing" && renderBillingStep()}
          {activeStepId === "overview" && renderOverviewStep()}
          {activeStepId === "payment" && renderPaymentStep()}

          {submissionError ? (
            <div className="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error">{submissionError}</div>
          ) : null}
          {stepError ? (
            <div className="rounded-2xl border border-warning bg-warning/10 p-4 text-sm text-warning">{stepError}</div>
          ) : null}

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {activeStepIndex > 0 ? (
              <button
                type="button"
                className="btn md:w-auto ui-border bg-base-200 text-base-content hover:bg-base-300"
                onClick={handleBack}
              >
                Zurück
              </button>
            ) : (
              <span />
            )}
            {showPrimaryButton ? (
              <button
                type="submit"
                className="btn btn-primary md:w-auto"
                disabled={submissionState === "submitting"}
                aria-disabled={submissionState === "submitting"}
              >
                {primaryActionLabel}
              </button>
            ) : (
              <span />
            )}
          </div>
        </form>
        {renderSummaryAside()}
      </div>
    </div>
  );
}
