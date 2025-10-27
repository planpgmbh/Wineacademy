#!/usr/bin/env python3
"""
Importhelfer für die Wine Academy Migration.

Liest die transformierten JSON-Dateien (`products.json`, `pages.json`) und baut daraus
Strapi-kompatible Payloads. Standardmäßig wird nichts in Strapi geschrieben, sondern
ein Dry-Run mit JSON-Ausgabe durchgeführt. Für einen echten Import müssen Basis-URL
und Admin-/API-Token angegeben werden.

Beispiel (Dry-Run eines Seminars):
    python3 scripts/import_wineacademy.py --type seminars --slug buchung-wset-level-2-weine --dry-run

Beispiel (POST gegen Strapi, benötigt gültigen Token):
    python3 scripts/import_wineacademy.py --type seminars --base-url http://localhost:1337 \
        --api-token <TOKEN> --publish
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent.parent
STRAPI_OUTPUT_DIR = BASE_DIR / "artifacts" / "crawl" / "structured" / "strapi"
PRODUCTS_JSON = STRAPI_OUTPUT_DIR / "products.json"
PAGES_JSON = STRAPI_OUTPUT_DIR / "pages.json"
CATEGORIES_JSON = STRAPI_OUTPUT_DIR / "categories.json"

DEFAULT_HEADERS = {"Content-Type": "application/json"}
SEMINAR_TYPES = {"seminar", "event", "seminar_online"}


def _content_manager_headers(options: "ImportOptions") -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {options.admin_token}",
        "X-STRAPI-ADMIN": "true",
    }


def _content_manager_base(options: "ImportOptions") -> str:
    if not options.base_url:
        raise RuntimeError("Base URL muss gesetzt sein, um Content-Manager-Requests zu senden.")
    return options.base_url.rstrip("/")


def _content_manager_request(method: str, endpoint: str, options: "ImportOptions", payload: Optional[Dict[str, object]] = None) -> requests.Response:
    if not options.admin_token:
        raise RuntimeError("Admin-Token erforderlich, um Content-Manager-Requests zu senden.")
    url = _content_manager_base(options) + endpoint
    headers = _content_manager_headers(options)
    response = requests.request(method, url, headers=headers, json=payload, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Content-Manager antwortete mit {response.status_code}: {response.text}"
        )
    return response


def _content_manager_get(endpoint: str, params: Dict[str, object], options: "ImportOptions") -> Dict[str, object]:
    if not options.admin_token:
        raise RuntimeError("Admin-Token erforderlich, um Content-Manager-Abfragen zu senden.")
    url = _content_manager_base(options) + endpoint
    headers = _content_manager_headers(options)
    response = requests.get(url, headers=headers, params=params, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Content-Manager GET antwortete mit {response.status_code}: {response.text}"
        )
    return response.json()


def _is_seminar_record(record: dict) -> bool:
    """
    Entscheidet, ob ein Datensatz als Seminar interpretiert werden soll.
    Neben dem expliziten content_type werden Slug- und URL-Heuristiken genutzt,
    damit Exporte ohne Migrations-Metadaten nicht aussortiert werden.
    """
    content_type = record.get("content_type") or record.get("migration_content_type")
    if content_type:
        return content_type in SEMINAR_TYPES

    slug = record.get("slug") or ""
    source_url = record.get("source_url") or ""
    if slug.startswith("buchung-"):
        return True
    if "/buchung/" in source_url:
        return True
    return False


@dataclass
class ImportOptions:
    base_url: Optional[str]
    api_token: Optional[str]
    admin_token: Optional[str]
    publish: bool
    dry_run: bool
    use_content_manager: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wine Academy → Strapi Import Helfer")
    parser.add_argument(
        "--type",
        choices=["seminars", "categories", "pages", "all"],
        default="seminars",
        help="Welche Inhalte importiert werden sollen (Standard: seminars).",
    )
    parser.add_argument(
        "--slug",
        help="Optional auf einen bestimmten Slug filtern (z.B. buchung-wset-level-2-weine).",
    )
    parser.add_argument(
        "--base-url",
        help="Strapi-Basis-URL (z.B. http://localhost:1337). Ohne Angabe wird kein HTTP-Import ausgeführt.",
    )
    parser.add_argument(
        "--api-token",
        help="Strapi API Token (bearer). Nur erforderlich, wenn tatsächlich importiert werden soll.",
    )
    parser.add_argument(
        "--admin-token",
        help="Strapi Admin JWT (Content-Manager-API). Alternative zu --api-token.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Nach dem Anlegen sofort veröffentlichen (setzt publishedAt).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur Payload anzeigen, nichts an Strapi senden (Standard, falls kein Token angegeben ist).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Anzahl der Datensätze begrenzen (zur Kontrolle/Testläufen).",
    )
    parser.add_argument(
        "--use-content-manager",
        action="store_true",
        help="Content-Manager-API statt Content-API verwenden (erfordert Admin-Token).",
    )
    return parser.parse_args()


def load_json(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Unerwartetes JSON-Format in {path} (erwarte Liste).")
    return data


def _clean_text(value: str) -> str:
    lines = [line.strip() for line in value.splitlines()]
    return "\n".join([line for line in lines if line])


def _convert_links_to_text(node: BeautifulSoup) -> None:
    for anchor in node.find_all("a"):
        href = anchor.get("href")
        label = anchor.get_text(" ", strip=True)
        replacement = label
        if href and not href.startswith("#"):
            if label:
                replacement = f"{label} ({href})"
            else:
                replacement = href
        anchor.replace_with(replacement if replacement else "")


def extract_short_description(html: Optional[str]) -> Optional[str]:
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    short = soup.select_one(".woocommerce-product-details__short-description")
    if not short:
        return None
    for removable in short.select(".product-description-link-container"):
        removable.decompose()
    _convert_links_to_text(short)
    raw_text = short.get_text("\n", strip=True)
    segments = [segment for segment in (line.strip() for line in raw_text.splitlines()) if segment]
    segments = [segment for segment in segments if segment.lower() != "beschreibung"]
    return _clean_text("\n".join(segments)) or None


def extract_tabs(html: Optional[str]) -> List[Dict[str, str]]:
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    tabs: List[Dict[str, str]] = []
    for tab_panel in soup.select(".woocommerce-Tabs-panel"):
        heading = tab_panel.find("h2")
        title = heading.get_text(strip=True) if heading else "Details"
        if heading:
            heading.extract()
        for br in tab_panel.find_all("br"):
            br.replace_with("\n")
        _convert_links_to_text(tab_panel)
        content_text = tab_panel.get_text("\n", strip=True)
        cleaned_text = _clean_text(content_text)
        tabs.append({"titel": title, "inhalt": cleaned_text or None})
    return tabs


def build_seminar_payload(record: dict) -> Dict[str, object]:
    title = record.get("title", "Unbenanntes Seminar")
    slug = record.get("slug")
    description_html = record.get("description_html")
    short_description = record.get("short_description_plain") or extract_short_description(description_html)
    raw_tabs = record.get("tabs_plain")
    if raw_tabs:
        tabs = [
            {"titel": tab.get("title"), "inhalt": _clean_text(tab.get("content") or "") or None}
            for tab in raw_tabs
        ]
    else:
        tabs = extract_tabs(description_html)
    seo = record.get("seo") or {}
    description_plain = short_description

    # Remove empty tab entries
    normalized_tabs = []
    for tab in tabs:
        titel = tab.get("titel")
        inhalt = _clean_text(tab.get("inhalt") or "") or None
        if titel and inhalt:
            normalized_tabs.append({"titel": titel, "inhalt": inhalt})
    tabs = normalized_tabs

    tab_title_overrides = ["Beschreibung", "Infos", "Download"]
    for idx, tab in enumerate(tabs):
        if idx < len(tab_title_overrides):
            tab["titel"] = tab_title_overrides[idx]

    kurzbeschreibung = seo.get("description") or short_description
    if kurzbeschreibung == description_plain and short_description:
        kurzbeschreibung = short_description

    bookingbox_payload = {
        "topline": "Jetzt Anmelden",
        "headline": "Sichere dir deinen Platz",
        "body": kurzbeschreibung,
    }

    payload: Dict[str, object] = {
        "name": title,
        "slug": slug,
        "kurzbeschreibung": kurzbeschreibung,
        "beschreibung": description_plain,
        "preis": f"{record.get('price_eur'):.2f}" if isinstance(record.get("price_eur"), (int, float)) else None,
        "mwst": True if record.get("price_eur") is not None else None,
        "aktiv": True,
        "seminarinhalte": tabs if tabs else None,
        "bookingbox": bookingbox_payload,
        "kapazitaet": 30,
        "seo": {
            "title": seo.get("title") or title,
            "description": seo.get("description"),
            "canonical": seo.get("canonical"),
            "robots": seo.get("robots"),
            "og_image": seo.get("og_image"),
        },
        "quelleUrl": record.get("source_url"),
    }

    # Felder mit None entfernen
    cleaned = {key: value for key, value in payload.items() if value not in (None, [], {})}
    return cleaned


def build_category_payload(record: dict) -> Dict[str, object]:
    name = record.get("name") or "Kategorie"
    slug = record.get("slug")
    description = record.get("description")
    short_description = record.get("short_description")
    seo = record.get("seo") or {}

    payload: Dict[str, object] = {
        "name": name,
        "slug": slug or None,
        "beschreibung": description or None,
        "kurzbeschreibung": short_description or None,
        "heroDarkMode": False,
        "seo": {
            "title": seo.get("title") or name,
            "description": seo.get("description") or short_description or description,
            "canonical": seo.get("canonical"),
            "robots": seo.get("robots"),
            "og_image": seo.get("og_image"),
        },
    }

    return {key: value for key, value in payload.items() if value not in (None, [], {})}


def post_to_strapi(endpoint: str, payload: Dict[str, object], options: ImportOptions) -> Optional[requests.Response]:
    if options.use_content_manager:
        response = _content_manager_request("POST", endpoint, options, payload)
        if options.publish:
            document_id = response.json().get("data", {}).get("documentId")
            if document_id:
                publish_endpoint = endpoint.rstrip("/") + f"/{document_id}/actions/publish"
                publish_response = _content_manager_request("POST", publish_endpoint, options, {})
                return publish_response
        return response

    if not options.base_url or not options.api_token:
        raise RuntimeError("Base URL und API Token müssen gesetzt sein, um Daten zu posten.")
    url = options.base_url.rstrip("/") + endpoint
    headers = DEFAULT_HEADERS.copy()
    headers["Authorization"] = f"Bearer {options.api_token}"
    body = {"data": payload}
    if options.publish:
        body["publish"] = True
    response = requests.post(url, headers=headers, json=body, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(f"Strapi antwortete mit {response.status_code}: {response.text}")
    return response


def process_seminars(options: ImportOptions, slug_filter: Optional[str], limit: Optional[int]) -> None:
    records = load_json(PRODUCTS_JSON)
    count = 0
    for record in records:
        if not _is_seminar_record(record):
            continue
        if slug_filter and record.get("slug") != slug_filter:
            continue
        payload = build_seminar_payload(record)
        count += 1
        if options.dry_run:
            print(json.dumps({"type": "seminar", "payload": payload}, indent=2, ensure_ascii=False))
        else:
            endpoint = (
                "/content-manager/collection-types/api::seminar.seminar"
                if options.use_content_manager
                else "/api/seminare"
            )
            action = "importiert"
            response_status: Optional[int] = None

            if options.use_content_manager:
                existing = None
                try:
                    existing_resp = _content_manager_get(
                        endpoint,
                        {
                            "filters[slug][$eq]": payload.get("slug"),
                            "pageSize": 1,
                        },
                        options,
                    )
                    results = existing_resp.get("results") or []
                    existing = results[0] if results else None
                except RuntimeError:
                    existing = None

                if existing:
                    document_id = existing.get("documentId")
                    response = _content_manager_request(
                        "PUT",
                        endpoint.rstrip("/") + f"/{document_id}",
                        options,
                        payload,
                    )
                    action = "aktualisiert"
                    response_status = response.status_code
                    if options.publish:
                        publish_endpoint = endpoint.rstrip("/") + f"/{document_id}/actions/publish"
                        _content_manager_request("POST", publish_endpoint, options, {})
                        response_status = 200
                else:
                    response = post_to_strapi(endpoint, payload, options)
                    if response is not None:
                        response_status = response.status_code
            else:
                response = post_to_strapi(endpoint, payload, options)
                if response is not None:
                    response_status = response.status_code

            if response_status is not None:
                print(f"[OK] Seminar {payload.get('slug')} {action} (Status {response_status})")
            else:
                print(f"[OK] Seminar {payload.get('slug')} {action}")
        if limit is not None and count >= limit:
            break
    if count == 0:
        print("Keine Seminar-Einträge für die gewählten Filter gefunden.", file=sys.stderr)


def process_categories(options: ImportOptions, slug_filter: Optional[str], limit: Optional[int]) -> None:
    records = load_json(CATEGORIES_JSON)
    count = 0
    for record in records:
        slug = record.get("slug")
        if slug_filter and slug != slug_filter:
            continue

        payload = build_category_payload(record)
        count += 1

        if options.dry_run:
            preview = {
                "type": "category",
                "payload": payload,
                "product_slugs": record.get("product_slugs", []),
            }
            print(json.dumps(preview, indent=2, ensure_ascii=False))
        else:
            endpoint = (
                "/content-manager/collection-types/api::kategorie.kategorie"
                if options.use_content_manager
                else "/api/kategorien"
            )
            action = "importiert"
            response: Optional[requests.Response]

            if options.use_content_manager:
                existing = None
                try:
                    existing_resp = _content_manager_get(
                        endpoint,
                        {
                            "filters[slug][$eq]": payload.get("slug"),
                            "pageSize": 1,
                        },
                        options,
                    )
                    results = existing_resp.get("results") or []
                    existing = results[0] if results else None
                except RuntimeError:
                    existing = None

                if existing:
                    document_id = existing.get("documentId")
                    response = _content_manager_request(
                        "PUT",
                        endpoint.rstrip("/") + f"/{document_id}",
                        options,
                        payload,
                    )
                    action = "aktualisiert"
                    if options.publish:
                        publish_endpoint = endpoint.rstrip("/") + f"/{document_id}/actions/publish"
                        _content_manager_request("POST", publish_endpoint, options, {})
                        response_status = 200
                    else:
                        response_status = response.status_code
                else:
                    response = post_to_strapi(endpoint, payload, options)
                    response_status = response.status_code if response is not None else None
            else:
                response = post_to_strapi(endpoint, payload, options)
                response_status = response.status_code if response is not None else None

            if response_status is not None:
                print(f"[OK] Kategorie {payload.get('slug') or payload.get('name')} {action} (Status {response_status})")
            else:
                print(f"[OK] Kategorie {payload.get('slug') or payload.get('name')} {action}")

        if limit is not None and count >= limit:
            break

    if count == 0:
        print("Keine Kategorie-Einträge für die gewählten Filter gefunden.", file=sys.stderr)


def main() -> None:
    args = parse_args()
    use_content_manager = args.use_content_manager or bool(args.admin_token)
    dry_run_default = args.dry_run or not args.base_url or (
        use_content_manager and not args.admin_token
    ) or (not use_content_manager and not args.api_token)

    options = ImportOptions(
        base_url=args.base_url,
        api_token=args.api_token,
        admin_token=args.admin_token,
        publish=args.publish,
        dry_run=dry_run_default,
        use_content_manager=use_content_manager,
    )

    if not options.dry_run:
        if options.use_content_manager and not options.admin_token:
            print("Content-Manager-Modus erfordert ein Admin-Token (--admin-token).", file=sys.stderr)
            sys.exit(1)
        if not options.use_content_manager and not options.api_token:
            print("API-Token (--api-token) erforderlich, wenn nicht im Dry-Run gearbeitet wird.", file=sys.stderr)
            sys.exit(1)
        if not options.base_url:
            print("Base-URL (--base-url) muss gesetzt sein, um Daten zu importieren.", file=sys.stderr)
            sys.exit(1)

    if args.type in {"seminars", "all"}:
        process_seminars(options, slug_filter=args.slug, limit=args.limit)
    if args.type in {"categories", "all"}:
        process_categories(options, slug_filter=args.slug, limit=args.limit)
    if args.type in {"pages", "all"}:
        print("[TODO] Page-Import wird in einem späteren Schritt ergänzt.")


if __name__ == "__main__":
    main()
