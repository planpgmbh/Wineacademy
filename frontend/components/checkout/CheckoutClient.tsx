"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  submitOrder
} from "@/lib/checkout";
import { PayPalButtons } from "@/components/payments/PayPalButtons";

type SeminarSelectionState = {
  selection: BookingSelection;
  seminarId: number;
  seminarTitle: string;
  terminId: number;
  terminLabel: string;
  terminDescription: string | null;
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
};

type VoucherSelectionState = {
  selection: VoucherSelection;
  amount: number;
  title: string;
  description?: string | null;
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

type ParticipantErrorState = {
  firstName: boolean;
  lastName: boolean;
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

type StepId = "participants" | "billing" | "overview" | "payment" | "confirmation";

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

type SummaryItem = {
  id: string;
  title: string;
  quantity: number;
  description?: string | null;
  subtotal: number | null;
  netto: number | null;
  steuerSatz: number | null;
  type: "seminar" | "produkt" | "gutschein";
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

function buildSteps(hasSeminar: boolean): StepDefinition[] {
  const steps: StepDefinition[] = [];
  if (hasSeminar) {
    steps.push({ id: "participants", label: "Teilnehmer" });
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
  const rate = taxRate ?? DEFAULT_VAT_RATE;
  if (!Number.isFinite(rate) || rate <= 0) {
    return Math.round((gross + Number.EPSILON) * 100) / 100;
  }
  const net = gross / (1 + rate / 100);
  return Math.round((net + Number.EPSILON) * 100) / 100;
}

function computeSummaryItems(
  seminarState: SeminarSelectionState | null,
  productState: ProductSelectionState | null,
  voucherState: VoucherSelectionState | null
): SummaryItem[] {
  const items: SummaryItem[] = [];

  if (seminarState) {
    const quantity = Math.max(1, seminarState.selection.quantity);
    const subtotal =
      seminarState.preisBrutto != null && Number.isFinite(seminarState.preisBrutto)
        ? seminarState.preisBrutto * quantity
        : null;
    const steuerSatz = seminarState.steuerSatz ?? DEFAULT_VAT_RATE;
    const netto = subtotal != null ? computeNetAmount(subtotal, steuerSatz) : null;

    items.push({
      id: `seminar-${seminarState.terminId}`,
      title: seminarState.seminarTitle,
      quantity,
      description: [seminarState.terminLabel, seminarState.terminDescription].filter(Boolean).join(" · "),
      subtotal,
      netto,
      steuerSatz,
      type: "seminar"
    });
  }

  if (productState) {
    const quantity = Math.max(1, productState.selection.quantity);
    const subtotal =
      productState.preisBrutto != null && Number.isFinite(productState.preisBrutto)
        ? productState.preisBrutto * quantity
        : productState.preisNetto != null && Number.isFinite(productState.preisNetto)
          ? productState.preisNetto * quantity
          : null;
    const netto =
      productState.preisNetto != null && Number.isFinite(productState.preisNetto)
        ? productState.preisNetto * quantity
        : subtotal != null
          ? computeNetAmount(subtotal, productState.steuerSatz)
          : null;

    items.push({
      id: `product-${productState.productId}`,
      title: productState.productTitle,
      quantity,
      description: productState.isVoucher ? "Geschenkgutschein" : undefined,
      subtotal,
      netto,
      steuerSatz: productState.steuerSatz,
      type: productState.isVoucher ? "gutschein" : "produkt"
    });
  }

  if (voucherState) {
    items.push({
      id: "voucher-selection",
      title: voucherState.title,
      quantity: 1,
      description: voucherState.description ?? "Geschenkgutschein",
      subtotal: voucherState.amount,
      netto: voucherState.amount,
      steuerSatz: 0,
      type: "gutschein"
    });
  }

  return items;
}

function computeTotals(items: SummaryItem[], voucher: VoucherRedemption | null) {
  const subtotal = items.reduce((acc, item) => acc + (item.subtotal ?? 0), 0);
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
  const total = Math.max(0, subtotal - discount);
  const net = Math.max(0, total - tax);

  return { subtotal, discount, tax, total, net };
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

  const seminarState = useMemo<SeminarSelectionState | null>(() => {
    if (!cartData.seminar || !cartData.seminarSelection) {
      return null;
    }
    const selection = cartData.seminarSelection;
    if (!selection.seminarSlug || !selection.dateId) {
      return null;
    }
    const terminId = Number(selection.dateId);
    if (!Number.isFinite(terminId)) {
      return null;
    }
    const quantity = Math.max(1, Math.trunc(selection.quantity ?? 1));
    const normalizedSelection: BookingSelection = {
      quantity,
      dateId: selection.dateId,
      seminarSlug: selection.seminarSlug,
      seminarTitle: selection.seminarTitle ?? cartData.seminar.title
    };
    const terminLabel = cartData.seminar.dates?.find((date) => date.id === selection.dateId)?.label;

    return {
      selection: normalizedSelection,
      seminarId: cartData.seminar.id,
      seminarTitle: cartData.seminar.title,
      terminId,
      terminLabel: terminLabel ?? `Termin #${selection.dateId}`,
      terminDescription: cartData.seminar.description ?? null,
      preisBrutto: cartData.seminar.price?.value ?? null,
      steuerSatz: cartData.seminar.price?.value != null ? DEFAULT_VAT_RATE : null
    };
  }, [cartData.seminar, cartData.seminarSelection]);

  const productState = useMemo<ProductSelectionState | null>(() => {
    if (!cartData.product || !cartData.productSelection?.productSlug) {
      return null;
    }
    const selection = cartData.productSelection;
    const quantity = Math.max(1, Math.trunc(selection.quantity ?? 1));
    const normalizedSelection: ProductSelection = {
      quantity,
      productSlug: selection.productSlug,
      productTitle: selection.productTitle ?? cartData.product.title,
      priceValue:
        selection.priceValue ?? cartData.product.price.value ?? null,
      priceFormatted:
        selection.priceFormatted ?? cartData.product.price.formatted ?? null,
      isVoucher: selection.isVoucher ?? cartData.product.isVoucher
    };

    return {
      selection: normalizedSelection,
      productId: cartData.product.id,
      productTitle: cartData.product.title,
      preisBrutto: normalizedSelection.priceValue ?? cartData.product.price.value ?? null,
      preisNetto: null,
      steuerSatz: null,
      isVoucher: cartData.product.isVoucher
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
      description: selection.description ?? null
    };
  }, [cartData.voucherSelection]);

  const [participants, setParticipants] = useState<ParticipantFormValue[]>([]);
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
  const [participantErrors, setParticipantErrors] = useState<ParticipantErrorState[]>([]);
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
  } | null>(null);

  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [queriedOrderId, setQueriedOrderId] = useState<number | null>(null);
  const [submittedPaymentMethod, setSubmittedPaymentMethod] = useState<PaymentMethod | null>(null);

  const [stepError, setStepError] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<StepId>("billing");
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);

  const hasSeminarSelection = Boolean(seminarState);
  const steps = useMemo(() => buildSteps(hasSeminarSelection), [hasSeminarSelection]);
  const isPayPalSelected = isPayPalConfigured && paymentMethod !== "rechnung";
  const activeStepIndex = useMemo(
    () => steps.findIndex((step) => step.id === activeStepId),
    [steps, activeStepId]
  );

  const summaryItems = useMemo(
    () => computeSummaryItems(seminarState, productState, voucherState),
    [productState, seminarState, voucherState]
  );
  const totals = useMemo(() => computeTotals(summaryItems, appliedVoucher), [summaryItems, appliedVoucher]);

  useEffect(() => {
    if (!steps.length) {
      return;
    }
    setFurthestStepIndex((current) => {
      const maxIndex = steps.length - 1;
      return current > maxIndex ? maxIndex : current;
    });
    if (!steps.some((step) => step.id === activeStepId)) {
      setActiveStepId(steps[steps.length - 1].id);
    }
  }, [steps, activeStepId]);

  useEffect(() => {
    if (seminarState && activeStepId === "billing" && furthestStepIndex === 0) {
      setActiveStepId("participants");
    }
    if (!seminarState && activeStepId === "participants") {
      setActiveStepId("billing");
    }
  }, [seminarState, activeStepId, furthestStepIndex]);

  useEffect(() => {
    const seatCount = seminarState?.selection.quantity ?? 0;
    if (!seminarState || seatCount <= 0) {
      setParticipants([]);
      return;
    }
    setParticipants((prev) => {
      const next = [...prev];
      if (next.length < seatCount) {
        for (let i = next.length; i < seatCount; i += 1) {
          next.push({
            firstName: "",
            lastName: "",
            email: "",
            wsetNumber: "",
            specialNeeds: ""
          });
        }
      } else if (next.length > seatCount) {
        next.splice(seatCount);
      }
      return next;
    });
  }, [seminarState?.selection.quantity, seminarState]);

  useEffect(() => {
    setParticipantErrors((prev) =>
      participants.map((_, index) => {
        const existing = prev[index];
        return existing ? { ...existing } : createParticipantErrorState();
      })
    );
  }, [participants]);

  useEffect(() => {
    if (participants.length === 0) {
      return;
    }
    setBilling((prev) => {
      if (prev.contactFirstName || prev.contactLastName || prev.contactEmail) {
        return prev;
      }
      const primaryParticipant = participants[0];
      return {
        ...prev,
        contactFirstName: primaryParticipant.firstName,
        contactLastName: primaryParticipant.lastName,
        contactEmail: primaryParticipant.email
      };
    });
  }, [participants]);

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

  const hasSelections = Boolean(seminarState || productState || voucherState);

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
    (index: number, field: keyof ParticipantFormValue, value: string) => {
      setParticipants((prev) => {
        const next = [...prev];
        if (!next[index]) {
          return prev;
        }
        next[index] = { ...next[index], [field]: value };
        return next;
      });
      if (field === "firstName" || field === "lastName") {
        setParticipantErrors((prev) => {
          const next = [...prev];
          if (next[index]) {
            next[index] = {
              ...next[index],
              [field === "firstName" ? "firstName" : "lastName"]: false
            };
          }
          return next;
        });
      }
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
    if (!seminarState) {
      setParticipantErrors([]);
      setStepError(null);
      return true;
    }
    if (participants.length === 0) {
      setParticipantErrors([]);
      setStepError("Bitte gib mindestens einen Teilnehmer ein.");
      return false;
    }

    const errors = participants.map((participant) => ({
      firstName: !participant.firstName.trim(),
      lastName: !participant.lastName.trim()
    }));
    setParticipantErrors(errors);

    const hasErrors = errors.some((entry) => entry.firstName || entry.lastName);
    if (hasErrors) {
      setStepError("Bitte fülle alle Pflichtfelder bei den Teilnehmerdaten aus.");
      return false;
    }

    setStepError(null);
    return true;
  }, [participants, seminarState]);

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
          zahlungsmethode: detail.zahlungsmethode ?? null
        });
        setSubmissionState("success");
        setActiveStepId("confirmation");
        setFurthestStepIndex(buildSteps(false).length - 1);
        setQueriedOrderId(id);
        setParticipants([]);
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

  const handleRemoveVoucher = useCallback(() => {
    setAppliedVoucher(null);
    setVoucherMessage("Der Gutscheincode wurde entfernt.");
  }, []);

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

      if (seminarState) {
        if (seminarState.preisBrutto == null) {
          throw new Error("Für die Seminarbuchung liegt kein Preis vor.");
        }
        const seatCount = Math.max(1, seminarState.selection.quantity);
        const steuerSatz = seminarState.steuerSatz ?? DEFAULT_VAT_RATE;
        const einzelpreisBrutto = seminarState.preisBrutto;
        const einzelpreisNetto = computeNetAmount(einzelpreisBrutto, steuerSatz) ?? undefined;

        positionen.push({
          typ: "seminar",
          titel: `${seminarState.seminarTitle} · ${seminarState.terminLabel}`,
          beschreibung: seminarState.terminDescription ?? undefined,
          terminId: seminarState.terminId,
          menge: seatCount,
          einzelpreisBrutto,
          einzelpreisNetto,
          steuerSatz
        });

        for (let index = 0; index < seatCount; index += 1) {
          const participant = participants[index] ?? participants[0];
          if (!participant) {
            throw new Error("Teilnehmerdaten fehlen.");
          }
          buchungen.push({
            vorname: participant.firstName.trim() || billing.contactFirstName.trim(),
            nachname: participant.lastName.trim() || billing.contactLastName.trim(),
            email: participant.email.trim() || billing.contactEmail.trim(),
            terminId: seminarState.terminId,
            wsetCandidateNumber: participant.wsetNumber.trim() || undefined,
            besondereBeduerfnisse: participant.specialNeeds.trim() || undefined
          });
        }
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

        positionen.push({
          typ: productState.isVoucher ? "gutschein" : "produkt",
          titel: productState.productTitle,
          produktId: productState.productId,
          menge: quantity,
          einzelpreisBrutto,
          einzelpreisNetto,
          steuerSatz: productState.steuerSatz ?? undefined
        });
      }

      if (voucherState) {
        positionen.push({
          typ: "gutschein",
          titel: voucherState.title,
          beschreibung: voucherState.description ?? undefined,
          menge: 1,
          betrag: voucherState.amount
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
        zahlungsmethode: response.zahlungsmethode
      });
      setQueriedOrderId(response.id);
      setSubmissionState("success");
      setSubmittedPaymentMethod(isPayPalFlow ? paymentMethod : null);
      setParticipants([]);
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
    seminarState,
    productState,
    voucherState,
    participants,
    billing,
    agbAccepted,
    privacyAccepted,
    newsletter,
    paymentMethod,
      appliedVoucher,
      isPayPalConfigured,
      clearSelections,
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
  }, [activeStepId, submissionState]);

  const showPrimaryButton = !(activeStepId === "payment" && isPayPalSelected);

  const renderParticipantsStep = () => (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-base-content">Teilnehmer</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Bitte gib die Teilnehmerdaten für alle gebuchten Plätze ein. Die Angaben lassen sich vor Abschluss jederzeit
          anpassen.
        </p>
      </div>
      <div className="space-y-6">
        {participants.map((participant, index) => (
          <div key={index} className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-base-content/80">Teilnehmer {index + 1}</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span
                  className={`label-text text-sm font-medium ${
                    participantErrors[index]?.firstName ? "text-error" : ""
                  }`}
                >
                  Vorname *
                </span>
                <input
                  type="text"
                  className={`input input-bordered ${
                    participantErrors[index]?.firstName ? "input-error" : ""
                  }`}
                  value={participant.firstName}
                  onChange={(event) => handleParticipantChange(index, "firstName", event.target.value)}
                  required
                />
                {participantErrors[index]?.firstName ? (
                  <span className="mt-1 text-xs text-error">Vorname ist erforderlich.</span>
                ) : null}
              </label>
              <label className="form-control">
                <span
                  className={`label-text text-sm font-medium ${
                    participantErrors[index]?.lastName ? "text-error" : ""
                  }`}
                >
                  Nachname *
                </span>
                <input
                  type="text"
                  className={`input input-bordered ${
                    participantErrors[index]?.lastName ? "input-error" : ""
                  }`}
                  value={participant.lastName}
                  onChange={(event) => handleParticipantChange(index, "lastName", event.target.value)}
                  required
                />
                {participantErrors[index]?.lastName ? (
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
                  onChange={(event) => handleParticipantChange(index, "email", event.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label className="form-control">
                <span className="label-text text-sm font-medium">WSET Candidate Number</span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={participant.wsetNumber}
                  onChange={(event) => handleParticipantChange(index, "wsetNumber", event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="mt-4">
              <label className="form-control">
                <span className="label-text text-sm font-medium">Besondere Bedürfnisse</span>
                <textarea
                  className="textarea textarea-bordered min-h-[96px]"
                  value={participant.specialNeeds}
                  onChange={(event) => handleParticipantChange(index, "specialNeeds", event.target.value)}
                  placeholder="Allergien, Barrierefreiheit oder andere Hinweise für unser Team"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderBillingStep = () => (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-base-content">Rechnungsadresse</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Wähle, ob die Rechnung auf eine Privatperson oder ein Unternehmen ausgestellt werden soll.
        </p>
      </div>
      <div className="join">
        <button
          type="button"
          className={`btn join-item ${billing.type === "privat" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => handleBillingTypeChange("privat")}
        >
          Privat
        </button>
        <button
          type="button"
          className={`btn join-item ${billing.type === "firma" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => handleBillingTypeChange("firma")}
        >
          Firma
        </button>
      </div>

      {billing.type === "firma" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control md:col-span-2">
            <span
              className={`label-text text-sm font-medium ${
                billingErrors.companyName ? "text-error" : ""
              }`}
            >
              Firmenname *
            </span>
            <input
              type="text"
              className={`input input-bordered ${
                billingErrors.companyName ? "input-error" : ""
              }`}
              value={billing.companyName}
              onChange={(event) => handleBillingChange("companyName", event.target.value)}
              required
            />
            {billingErrors.companyName ? (
              <span className="mt-1 text-xs text-error">{billingErrors.companyName}</span>
            ) : null}
          </label>
          <label className="form-control">
            <span className="label-text text-sm font-medium">Umsatzsteuer-ID</span>
            <input
              type="text"
              className="input input-bordered"
              value={billing.vatId}
              onChange={(event) => handleBillingChange("vatId", event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="form-control">
            <span
              className={`label-text text-sm font-medium ${
                billingErrors.invoiceEmail ? "text-error" : ""
              }`}
            >
              Rechnungs-E-Mail *
            </span>
            <input
              type="email"
              className={`input input-bordered ${
                billingErrors.invoiceEmail ? "input-error" : ""
              }`}
              value={billing.invoiceEmail}
              onChange={(event) => handleBillingChange("invoiceEmail", event.target.value)}
              required
            />
            {billingErrors.invoiceEmail ? (
              <span className="mt-1 text-xs text-error">{billingErrors.invoiceEmail}</span>
            ) : null}
          </label>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control md:col-span-2">
          <span
            className={`label-text text-sm font-medium ${
              billingErrors.street ? "text-error" : ""
            }`}
          >
            Straße und Hausnummer *
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.street ? "input-error" : ""}`}
            value={billing.street}
            onChange={(event) => handleBillingChange("street", event.target.value)}
            required
          />
          {billingErrors.street ? (
            <span className="mt-1 text-xs text-error">{billingErrors.street}</span>
          ) : null}
        </label>
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${billingErrors.zip ? "text-error" : ""}`}
          >
            Postleitzahl *
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.zip ? "input-error" : ""}`}
            value={billing.zip}
            onChange={(event) => handleBillingChange("zip", event.target.value)}
            required
          />
          {billingErrors.zip ? (
            <span className="mt-1 text-xs text-error">{billingErrors.zip}</span>
          ) : null}
        </label>
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${billingErrors.city ? "text-error" : ""}`}
          >
            Stadt *
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.city ? "input-error" : ""}`}
            value={billing.city}
            onChange={(event) => handleBillingChange("city", event.target.value)}
            required
          />
          {billingErrors.city ? (
            <span className="mt-1 text-xs text-error">{billingErrors.city}</span>
          ) : null}
        </label>
        <label className="form-control md:col-span-2">
          <span
            className={`label-text text-sm font-medium ${
              billingErrors.country ? "text-error" : ""
            }`}
          >
            Land *
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.country ? "input-error" : ""}`}
            value={billing.country}
            onChange={(event) => handleBillingChange("country", event.target.value)}
            required
          />
          {billingErrors.country ? (
            <span className="mt-1 text-xs text-error">{billingErrors.country}</span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${
              billingErrors.contactFirstName ? "text-error" : ""
            }`}
          >
            {billing.type === "firma" ? "Ansprechpartner Vorname *" : "Vorname *"}
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.contactFirstName ? "input-error" : ""}`}
            value={billing.contactFirstName}
            onChange={(event) => handleBillingChange("contactFirstName", event.target.value)}
            required
          />
          {billingErrors.contactFirstName ? (
            <span className="mt-1 text-xs text-error">{billingErrors.contactFirstName}</span>
          ) : null}
        </label>
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${
              billingErrors.contactLastName ? "text-error" : ""
            }`}
          >
            {billing.type === "firma" ? "Ansprechpartner Nachname *" : "Nachname *"}
          </span>
          <input
            type="text"
            className={`input input-bordered ${billingErrors.contactLastName ? "input-error" : ""}`}
            value={billing.contactLastName}
            onChange={(event) => handleBillingChange("contactLastName", event.target.value)}
            required
          />
          {billingErrors.contactLastName ? (
            <span className="mt-1 text-xs text-error">{billingErrors.contactLastName}</span>
          ) : null}
        </label>
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${
              billingErrors.contactEmail ? "text-error" : ""
            }`}
          >
            E-Mail *
          </span>
          <input
            type="email"
            className={`input input-bordered ${billingErrors.contactEmail ? "input-error" : ""}`}
            value={billing.contactEmail}
            onChange={(event) => handleBillingChange("contactEmail", event.target.value)}
            required
          />
          {billingErrors.contactEmail ? (
            <span className="mt-1 text-xs text-error">{billingErrors.contactEmail}</span>
          ) : null}
        </label>
        <label className="form-control">
          <span
            className={`label-text text-sm font-medium ${billingErrors.phone ? "text-error" : ""}`}
          >
            Telefon *
          </span>
          <input
            type="tel"
            className={`input input-bordered ${billingErrors.phone ? "input-error" : ""}`}
            value={billing.phone}
            onChange={(event) => handleBillingChange("phone", event.target.value)}
            required
          />
          {billingErrors.phone ? (
            <span className="mt-1 text-xs text-error">{billingErrors.phone}</span>
          ) : null}
        </label>
      </div>
    </section>
  );

  const renderOverviewStep = () => (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-base-content">Bestellübersicht</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Prüfe alle Angaben vor dem Zahlungsschritt. Du kannst einzelne Bereiche jederzeit bearbeiten.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-base-content">Warenkorb / Artikel</h3>
            <span className="text-sm font-medium text-base-content/70">
              Gesamtsumme: {formatCurrency(totals.total)}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {summaryItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-base-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-base-content">{item.title}</p>
                    <p className="mt-1 text-sm text-base-content/70">Menge: {item.quantity}</p>
                    {item.description ? (
                      <p className="mt-2 text-sm text-base-content/60">{item.description}</p>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-base-content">
                    {formatCurrency(item.subtotal ?? null)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {seminarState ? (
          <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-base-content">Teilnehmerdaten</h3>
              <button type="button" className="btn btn-link btn-sm px-0" onClick={() => goToStep("participants")}>
                Bearbeiten
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-base-content/80">
              {participants.map((participant, index) => (
                <div key={index} className="rounded-xl border border-base-200 p-4">
                  <p className="font-semibold">
                    Teilnehmer {index + 1}: {participant.firstName || "—"} {participant.lastName || "—"}
                  </p>
                  {participant.email ? <p className="mt-1 text-base-content/70">{participant.email}</p> : null}
                  {participant.wsetNumber ? (
                    <p className="mt-1 text-base-content/70">WSET Candidate Number: {participant.wsetNumber}</p>
                  ) : null}
                  {participant.specialNeeds ? (
                    <p className="mt-1 text-base-content/70">
                      Besondere Bedürfnisse: {participant.specialNeeds}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-base-content">Rechnungsadresse</h3>
            <button type="button" className="btn btn-link btn-sm px-0" onClick={() => goToStep("billing")}>
              Bearbeiten
            </button>
          </div>
          <div className="mt-4 text-sm text-base-content/80">
            {billing.type === "firma" && billing.companyName ? (
              <p className="font-semibold">{billing.companyName}</p>
            ) : null}
            {billing.type === "firma" && billing.vatId ? (
              <p className="text-base-content/70">USt-ID: {billing.vatId}</p>
            ) : null}
            <p>
              {billing.contactFirstName} {billing.contactLastName}
            </p>
            <p className="text-base-content/70">{billing.street}</p>
            <p className="text-base-content/70">
              {billing.zip} {billing.city}
            </p>
            <p className="text-base-content/70">{billing.country}</p>
            <div className="mt-2 space-y-1">
              <p className="text-base-content/70">E-Mail: {billing.contactEmail}</p>
              {billing.type === "firma" && billing.invoiceEmail ? (
                <p className="text-base-content/70">Rechnungs-E-Mail: {billing.invoiceEmail}</p>
              ) : null}
              <p className="text-base-content/70">Telefon: {billing.phone}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-base-content">Rabatt / Gutscheincode</h3>
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
                  className="btn btn-outline btn-error gap-2"
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
                  className={`btn btn-outline ${voucherChecking ? "loading" : ""}`}
                  onClick={handleVoucherCheck}
                  disabled={voucherChecking}
                >
                  Code prüfen
                </button>
              )}
            </div>
          </div>
          {voucherMessage ? (
            <p className="mt-3 text-sm text-base-content/70">{voucherMessage}</p>
          ) : null}
          {appliedVoucher ? (
            <div className="mt-4 rounded-xl border border-primary bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-base-content">
                Rabattcode angewendet: {appliedVoucher.code.toUpperCase()}
              </p>
              <p className="mt-1 text-base-content/70">
                Abzug: {formatCurrency(appliedVoucher.amount)}
                {appliedVoucher.remaining != null
                  ? ` · Restguthaben: ${formatCurrency(appliedVoucher.remaining)}`
                  : null}
              </p>
              {appliedVoucher.description ? (
                <p className="mt-1 text-base-content/60">{appliedVoucher.description}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="label cursor-pointer gap-3">
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
            <span className={`label-text text-sm ${agbError ? "text-error" : ""}`}>
              Ich akzeptiere die Allgemeinen Geschäftsbedingungen der Wine Academy Hamburg. *
            </span>
          </label>
          {agbError ? (
            <p className="pl-7 text-xs text-error">Bitte bestätige die Allgemeinen Geschäftsbedingungen.</p>
          ) : null}
          <label className="label cursor-pointer gap-3">
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
            <span className={`label-text text-sm ${privacyError ? "text-error" : ""}`}>
              Ich bestätige, die Datenschutzhinweise gelesen zu haben und stimme der Verarbeitung meiner Daten zu. *
            </span>
          </label>
          {privacyError ? (
            <p className="pl-7 text-xs text-error">Bitte bestätige den Datenschutzhinweis.</p>
          ) : null}
          <label className="label cursor-pointer gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={newsletter}
              onChange={(event) => setNewsletter(event.target.checked)}
            />
            <span className="label-text text-sm">
              Ich möchte Neuigkeiten der Wine Academy per E-Mail erhalten (optional, jederzeit abbestellbar).
            </span>
          </label>
        </div>
      </div>
    </section>
  );

  const renderPaymentStep = () => {
    const currentPayPalOption =
      isPayPalConfigured && paymentMethod !== "rechnung"
        ? PAYPAL_OPTION_CONFIG[paymentMethod as Exclude<PaymentMethod, "rechnung">]
        : null;
    const paypalDisabled = totals.total <= 0 || submissionState === "submitting";

    return (
      <section className="space-y-6">
        <div>
        <h2 className="text-xl font-semibold text-base-content">Zahlung</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Wähle deine bevorzugte Zahlungsart und bestätige die rechtlichen Hinweise.
        </p>
        </div>

        <div className="space-y-3">
        {PAYMENT_OPTIONS.map((option) => {
          const optionDisabled = option.value !== "rechnung" && !isPayPalConfigured;
          const isChecked = paymentMethod === option.value;
          return (
            <label
              key={option.value}
              className={`flex items-start gap-4 rounded-2xl border p-4 ${
                isChecked ? "border-primary bg-primary/5" : "border-base-200 bg-base-100"
              } ${optionDisabled ? "opacity-60" : ""}`}
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
              <div>
                <p className="font-semibold text-base-content">{option.label}</p>
                {option.description ? (
                  <p className="mt-1 text-sm text-base-content/70">{option.description}</p>
                ) : null}
                {optionDisabled ? (
                  <p className="mt-1 text-xs text-warning">
                    PayPal ist noch nicht konfiguriert. Bitte hinterlege die Umgebungsvariable
                    {" "}
                    <code className="mx-1">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>.
                  </p>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>

      {currentPayPalOption ? (
        <div className="rounded-2xl border border-primary/50 bg-primary/5 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-base-content">{currentPayPalOption.title}</h3>
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
      ) : !isPayPalConfigured ? (
        <div className="rounded-2xl border border-warning bg-warning/10 p-5 text-sm text-warning">
          PayPal-Zahlungen stehen aktuell nicht zur Verfügung. Bitte ergänze die Umgebungsvariable
          {" "}
          <code className="mx-1">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>, um PayPal, Lastschrift oder Kreditkarte zu aktivieren.
        </div>
      ) : null}
      </section>
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

    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-success/30 bg-success/10 p-10 text-center shadow-sm">
        <h2 className="text-3xl font-semibold text-success">Vielen Dank für deine Bestellung!</h2>
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
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => router.push("/")}>
            Zurück zur Startseite
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => router.push("/konto/bestellungen")}
          >
            Meine Bestellungen ansehen
          </button>
        </div>
      </div>
    );
  };

  const renderSummaryAside = () => (
    <aside className="space-y-6 rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-base-content">Deine Bestellung</h2>
        <div className="mt-4 space-y-4">
          {summaryItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-base-200 p-4">
              <p className="text-base font-semibold text-base-content">{item.title}</p>
              <p className="mt-1 text-sm text-base-content/70">Menge: {item.quantity}</p>
              {item.description ? (
                <p className="mt-1 text-sm text-base-content/60">{item.description}</p>
              ) : null}
              <p className="mt-2 text-base font-semibold text-base-content">
                {formatCurrency(item.subtotal ?? null)}
              </p>
            </div>
          ))}
          {summaryItems.length === 0 ? (
            <p className="text-sm text-base-content/60">
              Keine Artikel ausgewählt. Bitte füge ein Seminar, Produkt oder einen Gutschein hinzu.
            </p>
          ) : null}
        </div>
      </div>
      <dl className="space-y-2 text-sm text-base-content">
        <div className="flex items-center justify-between">
          <dt>Zwischensumme</dt>
          <dd>{formatCurrency(totals.subtotal)}</dd>
        </div>
        {appliedVoucher ? (
          <div className="flex items-center justify-between text-error">
            <dt>Rabatt ({appliedVoucher.code.toUpperCase()})</dt>
            <dd>-{formatCurrency(appliedVoucher.amount)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <dt>Steuern</dt>
          <dd>{formatCurrency(totals.tax)}</dd>
        </div>
        <div className="flex items-center justify-between text-base font-semibold">
          <dt>Gesamtsumme</dt>
          <dd>{formatCurrency(totals.total)}</dd>
        </div>
      </dl>
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
        <h1 className="text-3xl font-semibold text-base-content">Dein Warenkorb ist leer</h1>
        <p className="mt-4 text-base text-base-content/70">
          Füge zunächst ein Seminar oder Produkt hinzu, um mit der Bestellung fortzufahren.
        </p>
      </div>
    );
  }

  if (activeStepId === "confirmation" && submissionState === "success") {
    return renderConfirmationStep();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-8">
      <h1 className="text-3xl font-semibold text-base-content">Checkout</h1>
      {loadError ? (
        <div className="mt-6 rounded-2xl border border-error bg-error/10 p-4 text-error">{loadError}</div>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <ul className="steps steps-horizontal">
          {steps.map((step, index) => {
            const isCompleted = index < furthestStepIndex;
            const isActive = step.id === activeStepId;
            const className = `step ${isActive || isCompleted ? "step-primary" : ""}`;
            const canNavigate = index <= furthestStepIndex;
            return (
              <li
                key={step.id}
                className={className}
                onClick={() => (canNavigate ? goToStep(step.id) : undefined)}
                aria-current={isActive ? "step" : undefined}
              >
                {step.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <form ref={formRef} className="space-y-8" onSubmit={handlePrimaryAction}>
          {activeStepId === "participants" && renderParticipantsStep()}
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
              <button type="button" className="btn btn-ghost md:w-auto" onClick={handleBack}>
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
