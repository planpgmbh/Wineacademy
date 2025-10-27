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

DEFAULT_HEADERS = {"Content-Type": "application/json"}
SEMINAR_TYPES = {"seminar", "event", "seminar_online"}


@dataclass
class ImportOptions:
    base_url: Optional[str]
    api_token: Optional[str]
    publish: bool
    dry_run: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wine Academy → Strapi Import Helfer")
    parser.add_argument(
        "--type",
        choices=["seminars", "pages", "all"],
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
    return parser.parse_args()


def load_json(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Unerwartetes JSON-Format in {path} (erwarte Liste).")
    return data


def extract_short_description(html: Optional[str]) -> Optional[str]:
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    short = soup.select_one(".woocommerce-product-details__short-description")
    if short:
        return short.get_text(" ", strip=True)
    return None


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
        content_html = tab_panel.decode_contents().strip()
        if content_html:
            tabs.append({"titel": title, "inhalt": content_html})
    return tabs


def build_seminar_payload(record: dict) -> Dict[str, object]:
    title = record.get("title", "Unbenanntes Seminar")
    slug = record.get("slug")
    description_html = record.get("description_html")
    short_description = extract_short_description(description_html)
    tabs = extract_tabs(description_html)
    seo = record.get("seo") or {}

    payload: Dict[str, object] = {
        "name": title,
        "slug": slug,
        "kurzbeschreibung": short_description or seo.get("description"),
        "beschreibung": description_html,
        "preis": f"{record.get('price_eur'):.2f}" if isinstance(record.get("price_eur"), (int, float)) else None,
        "mwst": True if record.get("price_eur") is not None else None,
        "aktiv": True,
        "seminarinhalte": tabs if tabs else None,
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


def post_to_strapi(endpoint: str, payload: Dict[str, object], options: ImportOptions) -> Optional[requests.Response]:
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
        if record.get("content_type") not in SEMINAR_TYPES:
            continue
        if slug_filter and record.get("slug") != slug_filter:
            continue
        payload = build_seminar_payload(record)
        count += 1
        if options.dry_run or not options.api_token:
            print(json.dumps({"type": "seminar", "payload": payload}, indent=2, ensure_ascii=False))
        else:
            endpoint = "/api/seminars"
            response = post_to_strapi(endpoint, payload, options)
            if response is not None:
                print(f"[OK] Seminar {payload.get('slug')} importiert (Status {response.status_code})")
        if limit is not None and count >= limit:
            break
    if count == 0:
        print("Keine Seminar-Einträge für die gewählten Filter gefunden.", file=sys.stderr)


def main() -> None:
    args = parse_args()
    options = ImportOptions(
        base_url=args.base_url,
        api_token=args.api_token,
        publish=args.publish,
        dry_run=args.dry_run or not args.api_token,
    )

    if args.type in {"seminars", "all"}:
        process_seminars(options, slug_filter=args.slug, limit=args.limit)
    if args.type in {"pages", "all"}:
        print("[TODO] Page-Import wird in einem späteren Schritt ergänzt.")


if __name__ == "__main__":
    main()
