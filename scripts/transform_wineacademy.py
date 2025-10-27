#!/usr/bin/env python3
"""
Wine Academy Content Transformer

Liest die von `crawl_wineacademy.py` erzeugten Artefakte und projiziert sie in
Strapi-kompatible JSON-Dateien (Produkte/Seminare, Seiten, Relationen, Assets).
Die erste Ausbaustufe konzentriert sich auf Produktseiten (Seminare) inklusive
SEO-Metadaten und Asset-Zuordnung.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
STRUCTURED_DIR = BASE_DIR / "artifacts" / "crawl" / "structured"
CONTENT_JSON = STRUCTURED_DIR / "content.json"
SEO_JSON = STRUCTURED_DIR / "seo.json"
NAV_JSON = STRUCTURED_DIR / "navigation.json"
OUTPUT_ROOT = STRUCTURED_DIR / "strapi"


@dataclass
class ProductRecord:
    slug: str
    title: str
    description_html: Optional[str]
    meta_description: Optional[str]
    canonical_url: Optional[str]
    breadcrumbs: List[Dict[str, Optional[str]]]
    images: List[Dict[str, Optional[str]]]
    price_eur: Optional[float]
    jsonld_offer: Optional[Dict[str, str]]
    source_url: str
    content_type: Optional[str]
    seo: Dict[str, Optional[str]]


@dataclass
class PageRecord:
    slug: str
    title: Optional[str]
    main_html: Optional[str]
    sections: List[Dict[str, object]]
    breadcrumbs: List[Dict[str, Optional[str]]]
    images: List[Dict[str, Optional[str]]]
    source_url: str
    content_type: Optional[str]
    seo: Dict[str, Optional[str]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wine Academy Content Transformer")
    parser.add_argument(
        "--type",
        choices=["products", "pages", "all"],
        default="products",
        help="Welche Inhalte transformiert werden sollen (Standard: products).",
    )
    parser.add_argument(
        "--output-dir",
        default=str(OUTPUT_ROOT),
        help="Zielverzeichnis für Strapi-Ausgaben (Standard: artifacts/crawl/structured/strapi).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur Statistiken ausgeben, keine Dateien schreiben.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional die Anzahl der zu verarbeitenden Datensätze begrenzen.",
    )
    return parser.parse_args()


def load_json_list(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Benötigte Datei nicht gefunden: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Erwartete JSON-Liste in {path}, erhalten: {type(data).__name__}")
    return data


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _normalize_images(entry: dict) -> List[Dict[str, Optional[str]]]:
    images = entry.get("assets", {}).get("images", [])
    return [
        {
            "url": img.get("url") if isinstance(img, dict) else img,
            "local_path": img.get("local_path") if isinstance(img, dict) else None,
        }
        for img in images
    ]


def _build_breadcrumbs(entry: dict) -> List[Dict[str, Optional[str]]]:
    breadcrumbs: List[Dict[str, Optional[str]]] = []
    for crumb in entry.get("breadcrumbs", []):
        items = crumb.get("items", [])
        for item in items:
            name = item.get("name")
            item_value = item.get("item")
            url = item_value if isinstance(item_value, str) else (item_value or {}).get("@id")
            if not name and isinstance(item_value, dict):
                name = item_value.get("name")
            breadcrumbs.append(
                {
                    "position": item.get("position"),
                    "name": name,
                    "url": url,
                }
            )
    return breadcrumbs


def map_migration(entry: dict, fallback_title: Optional[str], fallback_description: Optional[str], fallback_canonical: Optional[str]) -> Tuple[Optional[str], Dict[str, Optional[str]]]:
    migration = entry.get("migration", {}) or {}
    content_type = migration.get("content_type") or entry.get("migration_content_type")
    seo_data = migration.get("seo") if isinstance(migration.get("seo"), dict) else {}
    seo_payload = {
        "title": seo_data.get("title") or fallback_title,
        "description": seo_data.get("description") or fallback_description,
        "canonical": seo_data.get("canonical") or fallback_canonical,
        "robots": seo_data.get("robots"),
        "og_image": seo_data.get("og_image"),
    }
    return content_type, seo_payload


def normalize_path_slug(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    return path or "root"


def extract_products(
    content_entries: List[dict],
    seo_entries: Dict[str, dict],
    nav_entries: Dict[str, dict],
    limit: Optional[int] = None,
) -> Tuple[List[ProductRecord], List[str]]:
    records: List[ProductRecord] = []
    skipped: List[str] = []
    count = 0

    for entry in content_entries:
        if entry.get("sitemap_source") != "product":
            continue

        source_url = entry["url"]
        slug = entry.get("slug")
        title = entry.get("title")
        body_sections = entry.get("content", {}).get("sections", [])
        description_html = None
        for section in body_sections:
            if section.get("heading", "").lower() in {"beschreibung", "description"}:
                description_html = section.get("html")
                break
        if description_html is None:
            description_html = entry.get("content", {}).get("main_html")

        # SEO & Breadcrumbs
        seo_entry = seo_entries.get(source_url, {})
        meta_description = seo_entry.get("meta", {}).get("description")
        canonical = seo_entry.get("meta", {}).get("canonical")
        breadcrumbs = _build_breadcrumbs(entry)

        # Assets & JSON-LD Offer
        normalized_images = _normalize_images(entry)

        price = None
        offer_obj = None
        for block in entry.get("structured_data", []):
            if isinstance(block, dict):
                offer = _find_first_offer(block)
                if offer:
                    offer_obj = offer
                    price_text = offer.get("price") or offer.get("priceSpecification", {}).get("price")
                    try:
                        price = float(price_text.replace(",", ".")) if price_text else None
                    except (TypeError, ValueError):
                        price = None
                    break

        if not slug or not title:
            skipped.append(source_url)
            continue

        content_type, seo_payload = map_migration(entry, title, meta_description, canonical)

        record = ProductRecord(
            slug=slug,
            title=title,
            description_html=description_html,
            meta_description=meta_description,
            canonical_url=canonical,
            breadcrumbs=breadcrumbs,
            images=normalized_images,
            price_eur=price,
            jsonld_offer=offer_obj,
            source_url=source_url,
            content_type=content_type,
            seo=seo_payload,
        )
        records.append(record)
        count += 1
        if limit is not None and count >= limit:
            break

    return records, skipped


def _find_first_offer(node: dict) -> Optional[Dict[str, object]]:
    """Durchsucht JSON-LD nach dem ersten Offer-Eintrag."""
    if "@type" in node and node["@type"] in {"Offer", "Product"}:
        if node["@type"] == "Offer":
            return node
        for candidate in node.get("offers", []):
            if isinstance(candidate, dict) and candidate.get("@type") == "Offer":
                return candidate
    for value in node.values():
        if isinstance(value, dict):
            result = _find_first_offer(value)
            if result:
                return result
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    result = _find_first_offer(item)
                    if result:
                        return result
    return None


def write_products(records: Iterable[ProductRecord], output_dir: Path, dry_run: bool) -> None:
    data = [asdict(record) for record in records]
    target = output_dir / "products.json"
    if dry_run:
        print(f"[DRY-RUN] Würde {len(data)} Produkte nach {target} schreiben.")
        return
    ensure_output_dir(output_dir)
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] {len(data)} Produkte exportiert -> {target}")


def extract_pages(
    content_entries: List[dict],
    limit: Optional[int] = None,
) -> List[PageRecord]:
    records: List[PageRecord] = []
    count = 0

    for entry in content_entries:
        title = entry.get("title")
        meta_description = entry.get("meta", {}).get("description")
        canonical = entry.get("meta", {}).get("canonical")

        content_type, seo_payload = map_migration(entry, title, meta_description, canonical)
        if content_type is None:
            if entry.get("migration_content_type"):
                content_type = entry.get("migration_content_type")
            elif entry.get("sitemap_source") == "page":
                content_type = "page"

        if content_type != "page":
            continue

        source_url = entry["url"]
        slug = normalize_path_slug(source_url)
        content_obj = entry.get("content", {})
        main_html = content_obj.get("main_html")
        sections = content_obj.get("sections", [])
        breadcrumbs = _build_breadcrumbs(entry)
        images = _normalize_images(entry)

        record = PageRecord(
            slug=slug,
            title=title,
            main_html=main_html,
            sections=sections,
            breadcrumbs=breadcrumbs,
            images=images,
            source_url=source_url,
            content_type=content_type,
            seo=seo_payload,
        )
        records.append(record)
        count += 1
        if limit is not None and count >= limit:
            break

    return records


def write_pages(records: Iterable[PageRecord], output_dir: Path, dry_run: bool) -> None:
    data = [asdict(record) for record in records]
    target = output_dir / "pages.json"
    if dry_run:
        print(f"[DRY-RUN] Würde {len(data)} Seiten nach {target} schreiben.")
        return
    ensure_output_dir(output_dir)
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] {len(data)} Seiten exportiert -> {target}")


def build_index(entries: List[dict]) -> Dict[str, dict]:
    return {entry["url"]: entry for entry in entries if "url" in entry}


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)

    content_entries = load_json_list(CONTENT_JSON)
    seo_entries = build_index(load_json_list(SEO_JSON))
    nav_entries = build_index(load_json_list(NAV_JSON))

    if args.type in {"products", "all"}:
        products, skipped = extract_products(content_entries, seo_entries, nav_entries, limit=args.limit)
        write_products(products, output_dir, args.dry_run)
        if skipped:
            print(f"[WARN] {len(skipped)} Produkte übersprungen (fehlender slug/title):")
            for url in skipped:
                print(f"  - {url}")

    if args.type in {"pages", "all"}:
        pages = extract_pages(content_entries, limit=args.limit)
        write_pages(pages, output_dir, args.dry_run)


if __name__ == "__main__":
    main()
