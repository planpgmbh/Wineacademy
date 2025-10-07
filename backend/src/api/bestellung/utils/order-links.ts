// Entfernt überflüssige Schrägstriche am Ende einer URL, damit Links sauber aussehen.
import { createDownloadToken } from './download-token';

const trimTrailingSlash = (value?: string | null): string | null => {
  if (!value) return null;
  return value.replace(/\/+$/, '');
};

// Suche nach der öffentlichen Basis-URL des Frontends.
const resolveFrontendBaseUrl = (): string | null => {
  const envBase =
    process.env.FRONTEND_BASE_URL ||
    process.env.STOREFRONT_BASE_URL ||
    process.env.SITE_BASE_URL;
  if (envBase) {
    return trimTrailingSlash(envBase);
  }
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    return trimTrailingSlash(publicUrl.replace(/\/api\/?$/, ''));
  }
  return null;
};

// Ermittelt die Adresse des Admin-Bereichs (für Backoffice-Links).
const resolveAdminBaseUrl = (): string | null => {
  const direct = trimTrailingSlash(process.env.ADMIN_BASE_URL);
  if (direct) return direct;
  const frontend = resolveFrontendBaseUrl();
  return frontend ? `${frontend}/admin` : null;
};

// Liefert die Basis für API-Aufrufe (z. B. zum Download von PDFs).
const resolveApiBaseUrl = (): string | null => {
  const direct = trimTrailingSlash(process.env.API_BASE_URL);
  if (direct) return direct;
  const publicUrl = trimTrailingSlash(process.env.PUBLIC_URL);
  if (publicUrl) {
    return publicUrl.endsWith('/api') ? publicUrl : `${publicUrl}/api`;
  }
  const frontend = resolveFrontendBaseUrl();
  return frontend ? `${frontend}/api` : null;
};

// Findet eine passende Kennung für die Bestellung (zuerst Dokument-ID, dann Bestellnummer, dann Datenbank-ID).
export const resolveOrderIdentifier = (order: any): string | null => {
  if (!order) return null;
  const candidates = [order.bestellnummer, order.documentId, order.id];
  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }
  return null;
};

// Baut den Download-Link für Rechnung oder Stornobeleg.
export const resolveInvoiceDownloadUrl = (order: any, variant: 'invoice' | 'storno'): string | null => {
  const apiBase = resolveApiBaseUrl();
  if (!apiBase) return null;
  const identifier = resolveOrderIdentifier(order);
  if (!identifier) return null;
  const hasDocument =
    variant === 'invoice' ? Boolean(order?.sevdeskDocumentId) : Boolean(order?.sevdeskStornoDocumentId);
  if (!hasDocument) {
    return null;
  }
  const suffix = variant === 'invoice' ? 'rechnung' : 'storno';
  const token = createDownloadToken(identifier, variant);
  if (!token) {
    return null;
  }
  const path = `${apiBase}/public/bestellungen/${encodeURIComponent(identifier)}/${suffix}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}`;
};

// Liefert den Link, mit dem das Backoffice die Bestellung direkt im Admin öffnen kann.
export const resolveAdminOrderLink = (order: any): string | null => {
  const adminBase = resolveAdminBaseUrl();
  if (!adminBase) return null;
  const identifier = resolveOrderIdentifier(order);
  if (!identifier) return null;
  return `${adminBase}/content-manager/collection-types/api::bestellung.bestellung/${encodeURIComponent(identifier)}`;
};

// Macht aus beliebigen Namen (mit Umlauten etc.) sichere Dateinamen.
const sanitiseFilename = (filename: string): string =>
  filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_');

// Erstellt den eigentlichen Dateinamen für Rechnung oder Stornobeleg.
export const buildDocumentFilename = (order: any, variant: 'invoice' | 'storno'): string => {
  const prefix = variant === 'invoice' ? 'Rechnung' : 'Storno';
  const identifier = resolveOrderIdentifier(order) || 'Dokument';
  const base = `${prefix}_${identifier}`;
  const safeBase = sanitiseFilename(base);
  return safeBase.toLowerCase().endsWith('.pdf') ? safeBase : `${safeBase}.pdf`;
};
