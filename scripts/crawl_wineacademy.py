#!/usr/bin/env python3
"""
Wine Academy Content Crawler (Erweiterung)

Liest URLs aus `artifacts/crawl/url-seed-list.txt`, speichert Roh-HTML und Assets
und legt strukturierte JSON-Dateien für Content-, SEO- und Navigationsdaten an.
Die erzeugten Artefakte dienen als Grundlage für Strapi-Seeds sowie Frontend-Imports.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_ROOT = BASE_DIR / "artifacts" / "crawl"
RAW_HTML_DIR = ARTIFACT_ROOT / "raw-html"
STRUCTURED_DIR = ARTIFACT_ROOT / "structured"
ASSETS_DIR = ARTIFACT_ROOT / "assets"
LOG_DIR = ARTIFACT_ROOT / "logs"
URL_SEED_FILE = ARTIFACT_ROOT / "url-seed-list.txt"
CONTENT_JSON = STRUCTURED_DIR / "content.json"
SEO_JSON = STRUCTURED_DIR / "seo.json"
NAVIGATION_JSON = STRUCTURED_DIR / "navigation.json"

ALLOWED_ASSET_HOSTS = {"www.wineacademy.de", "wineacademy.de"}
ASSET_EXT_WHITELIST = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".avif",
    ".pdf",
    ".css",
    ".js",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
}
ASSET_KEYS = ("images", "stylesheets", "scripts", "downloads")


@dataclass
class AssetEntry:
    url: str
    local_path: Optional[str]


@dataclass
class PageRecord:
    url: str
    sitemap_source: Optional[str]
    fetched_at: str
    http_status: int
    raw_html_path: str
    slug: str
    language: Optional[str]
    title: Optional[str]
    meta: Dict[str, object]
    body: Dict[str, object]
    structured_data: List[object]
    breadcrumbs: List[Dict[str, object]]
    content: Dict[str, object]
    assets: Dict[str, List[AssetEntry]]
    links: Dict[str, List[str]]


def ensure_directories() -> None:
    for directory in (RAW_HTML_DIR, STRUCTURED_DIR, ASSETS_DIR, LOG_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def load_seed_urls(limit: Optional[int] = None) -> List[Tuple[str, Optional[str]]]:
    """Liest Seed-URLs und annotiert sie mit einer groben Content-Kategorie."""
    if not URL_SEED_FILE.exists():
        raise FileNotFoundError(f"Seed-Datei nicht gefunden: {URL_SEED_FILE}")

    seeds: List[Tuple[str, Optional[str]]] = []
    with URL_SEED_FILE.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            url = raw_line.strip()
            if not url:
                continue
            source = None
            if "/buchung/" in url:
                source = "product"
            elif "/kalender" in url:
                source = "calendar"
            elif "/wine-academy" in url or "/kurse" in url or url.endswith("/"):
                source = "page"
            seeds.append((url, source))
    if limit is not None and limit > 0:
        seeds = seeds[:limit]
    return seeds


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "WineAcademyCrawler/1.0 (+https://wineacademymain.plan-p.de)",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        }
    )
    return session


def fetch_html(url: str, session: requests.Session) -> Tuple[int, str]:
    """Ruft die URL ab und liefert Status-Code sowie HTML."""
    resp = session.get(url, timeout=20)
    resp.raise_for_status()
    return resp.status_code, resp.text


def slugify_url(url: str) -> str:
    """Erzeugt einen Dateinamen-Slug aus der URL."""
    parsed = urlparse(url)
    path = parsed.path.strip("/") or "root"
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", path)
    if parsed.query:
        safe += "-" + re.sub(r"[^a-zA-Z0-9._-]+", "-", parsed.query)
    return safe.lower()


def save_raw_html(slug: str, html: str) -> Path:
    target = RAW_HTML_DIR / f"{slug}.html"
    target.write_text(html, encoding="utf-8")
    return target


def extract_meta_tags(soup: BeautifulSoup) -> Dict[str, object]:
    meta: Dict[str, object] = {
        "description": None,
        "robots": None,
        "canonical": None,
        "og": {},
        "twitter": {},
        "alternates": [],
    }
    head = soup.head
    if not head:
        return meta

    if (meta_desc := head.find("meta", attrs={"name": "description"})) and meta_desc.get("content"):
        meta["description"] = meta_desc["content"].strip()

    if (meta_robots := head.find("meta", attrs={"name": "robots"})) and meta_robots.get("content"):
        meta["robots"] = meta_robots["content"].strip()

    if (canonical := head.find("link", attrs={"rel": lambda x: x and "canonical" in [r.lower() for r in x]})) and canonical.get("href"):
        meta["canonical"] = canonical["href"].strip()

    for tag in head.find_all("meta"):
        if property_attr := tag.get("property"):
            lower = property_attr.lower()
            if lower.startswith("og:") and tag.get("content"):
                meta["og"][lower] = tag["content"].strip()
        if name_attr := tag.get("name"):
            name_lower = name_attr.lower()
            if name_lower.startswith("twitter:") and tag.get("content"):
                meta["twitter"][name_lower] = tag["content"].strip()

    for link in head.find_all("link", attrs={"rel": True, "href": True}):
        rels = [r.lower() for r in link.get("rel", [])]
        if "alternate" in rels:
            meta["alternates"].append(
                {
                    "hreflang": link.get("hreflang"),
                    "href": link["href"],
                }
            )
    return meta


def extract_body_info(soup: BeautifulSoup) -> Dict[str, object]:
    body_info: Dict[str, object] = {"classes": [], "headings": {}}
    body = soup.body
    if not body:
        return body_info

    body_info["classes"] = body.get("class", [])
    heading_map: Dict[str, List[str]] = {}
    for level in ["h1", "h2", "h3"]:
        heading_map[level] = [tag.get_text(strip=True) for tag in body.find_all(level)]
    body_info["headings"] = heading_map
    return body_info


def extract_structured_data(soup: BeautifulSoup) -> List[object]:
    blocks: List[object] = []
    for script_tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script_tag.string
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            cleaned = raw.replace("\n", " ").strip()
            try:
                blocks.append(json.loads(cleaned))
            except json.JSONDecodeError:
                blocks.append({"raw": raw, "error": "json_decode_error"})
    return blocks


def extract_breadcrumbs(structured_data: List[object]) -> List[Dict[str, object]]:
    breadcrumbs: List[Dict[str, object]] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if node.get("@type") == "BreadcrumbList":
                items = []
                for item in node.get("itemListElement", []):
                    if not isinstance(item, dict):
                        continue
                    items.append(
                        {
                            "position": item.get("position"),
                            "name": item.get("name"),
                            "item": item.get("item"),
                        }
                    )
                if items:
                    breadcrumbs.append({"context": node.get("@id"), "items": items})
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for entry in node:
                walk(entry)

    walk(structured_data)
    return breadcrumbs


def extract_content_sections(soup: BeautifulSoup) -> Dict[str, object]:
    body = soup.body
    main = soup.find("main") or body
    content = {"main_html": None, "sections": []}
    if main:
        content["main_html"] = main.decode()
        for section in main.find_all(["section", "article", "div"], recursive=False):
            heading = section.find(["h1", "h2", "h3"])
            content["sections"].append(
                {
                    "tag": section.name,
                    "id": section.get("id"),
                    "classes": section.get("class", []),
                    "heading": heading.get_text(strip=True) if heading else None,
                    "html": section.decode(),
                }
            )
    return content


def classify_links_and_assets(soup: BeautifulSoup, base_url: str) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
    internal: List[str] = []
    external: List[str] = []
    images: List[str] = []
    stylesheets: List[str] = []
    scripts: List[str] = []
    downloads: List[str] = []

    parsed_base = urlparse(base_url)
    base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        absolute = urljoin(base_url, href)
        if absolute.startswith(base_domain):
            internal.append(absolute)
        else:
            external.append(absolute)
        if any(absolute.lower().endswith(ext) for ext in (".pdf", ".doc", ".docx", ".xls", ".xlsx")):
            downloads.append(absolute)

    for img in soup.find_all("img", src=True):
        images.append(urljoin(base_url, img["src"].strip()))

    for link_tag in soup.find_all("link", href=True):
        rel = [r.lower() for r in link_tag.get("rel", [])]
        href = urljoin(base_url, link_tag["href"].strip())
        if "stylesheet" in rel:
            stylesheets.append(href)

    for script_tag in soup.find_all("script", src=True):
        scripts.append(urljoin(base_url, script_tag["src"].strip()))

    asset_map = {
        "images": images,
        "stylesheets": stylesheets,
        "scripts": scripts,
        "downloads": downloads,
    }
    link_map = {"internal": internal, "external": external}
    return link_map, asset_map


def should_download_asset(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    if parsed.netloc.lower() not in ALLOWED_ASSET_HOSTS:
        return False
    suffix = Path(parsed.path).suffix.lower()
    return suffix in ASSET_EXT_WHITELIST


def build_asset_local_path(url: str) -> Path:
    parsed = urlparse(url)
    host_dir = parsed.netloc.lower() or "unknown-host"
    path = parsed.path or "/"
    if path.endswith("/"):
        remote_path = Path(path.lstrip("/")) / "index"
    else:
        remote_path = Path(path.lstrip("/")) if path != "/" else Path("root")
    local_path = ASSETS_DIR / host_dir / remote_path
    if parsed.query:
        digest = hashlib.md5(parsed.query.encode("utf-8")).hexdigest()[:8]
        stem = local_path.stem
        suffix = "".join(local_path.suffixes)
        local_path = local_path.with_name(f"{stem}__{digest}{suffix}")
    local_path.parent.mkdir(parents=True, exist_ok=True)
    return local_path


def download_asset(url: str, session: requests.Session, cache: Dict[str, Optional[Path]]) -> Optional[Path]:
    if not should_download_asset(url):
        cache[url] = None
        return None
    if url in cache:
        return cache[url]
    local_path = build_asset_local_path(url)
    try:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"[WARN] Asset konnte nicht geladen werden ({url}): {exc}")
        cache[url] = None  # Markiert als fehlgeschlagen
        return None
    local_path.write_bytes(resp.content)
    cache[url] = local_path
    return local_path


def download_and_map_assets(assets: Dict[str, List[str]], session: requests.Session, cache: Dict[str, Optional[Path]]) -> Dict[str, List[AssetEntry]]:
    mapped: Dict[str, List[AssetEntry]] = {}
    for asset_type, urls in assets.items():
        entries: List[AssetEntry] = []
        for url in urls:
            local: Optional[Path]
            if cache.get(url) is None:
                local = None
            else:
                local = cache.get(url)
                if local is None:
                    local = None
                elif not local.exists():
                    local = None
            if local is None:
                result = download_asset(url, session, cache)
                local = result if result is not None else None
            entries.append(
                AssetEntry(
                    url=url,
                    local_path=str(local.relative_to(BASE_DIR)) if isinstance(local, Path) else None,
                )
            )
        mapped[asset_type] = entries
    return mapped


def build_page_record(
    url: str,
    sitemap_source: Optional[str],
    status: int,
    html: str,
    raw_path: Path,
    session: requests.Session,
    asset_cache: Dict[str, Optional[Path]],
) -> PageRecord:
    soup = BeautifulSoup(html, "lxml")
    language = soup.html.get("lang") if soup.html else None
    title = soup.title.string.strip() if soup.title and soup.title.string else None

    meta = extract_meta_tags(soup)
    body_info = extract_body_info(soup)
    structured_data = extract_structured_data(soup)
    breadcrumbs = extract_breadcrumbs(structured_data)
    content = extract_content_sections(soup)
    links, asset_urls = classify_links_and_assets(soup, url)
    assets = download_and_map_assets(asset_urls, session, asset_cache)

    slug = slugify_url(url)
    fetched_at = datetime.now(timezone.utc).isoformat()

    return PageRecord(
        url=url,
        sitemap_source=sitemap_source,
        fetched_at=fetched_at,
        http_status=status,
        raw_html_path=str(raw_path.relative_to(BASE_DIR)),
        slug=slug,
        language=language,
        title=title,
        meta=meta,
        body=body_info,
        structured_data=structured_data,
        breadcrumbs=breadcrumbs,
        content=content,
        assets=assets,
        links=links,
    )


def load_existing_json(path: Path) -> Dict[str, dict]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, list):
                return {entry["url"]: entry for entry in data if isinstance(entry, dict) and "url" in entry}
            if isinstance(data, dict):
                return data
    except json.JSONDecodeError:
        pass
    return {}


def store_json_list(path: Path, entries: Dict[str, dict]) -> None:
    ordered = [entries[url] for url in sorted(entries.keys())]
    path.write_text(json.dumps(ordered, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize_asset_list(raw: object) -> List[Dict[str, Optional[str]]]:
    normalized: List[Dict[str, Optional[str]]] = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and "url" in item:
                normalized.append(
                    {
                        "url": item.get("url"),
                        "local_path": item.get("local_path"),
                    }
                )
            elif isinstance(item, str):
                normalized.append({"url": item, "local_path": None})
    return normalized


def normalize_content_entry(entry: dict) -> dict:
    entry.setdefault("breadcrumbs", [])
    entry.setdefault("content", {"main_html": None, "sections": []})
    assets = entry.get("assets", {})
    normalized_assets: Dict[str, List[Dict[str, Optional[str]]]] = {}
    for key in ASSET_KEYS:
        normalized_assets[key] = normalize_asset_list(assets.get(key, []))
    entry["assets"] = normalized_assets
    entry.setdefault("links", {"internal": [], "external": []})
    return entry


def store_records(records: Iterable[PageRecord]) -> None:
    existing = load_existing_json(CONTENT_JSON)
    for url, entry in list(existing.items()):
        if isinstance(entry, dict):
            existing[url] = normalize_content_entry(entry)
    for record in records:
        existing[record.url] = normalize_content_entry(asdict(record))
    store_json_list(CONTENT_JSON, existing)


def store_navigation(records: Iterable[PageRecord]) -> None:
    existing = load_existing_json(NAVIGATION_JSON)
    for record in records:
        existing[record.url] = {
            "url": record.url,
            "slug": record.slug,
            "breadcrumbs": record.breadcrumbs,
            "sitemap_source": record.sitemap_source,
        }
    store_json_list(NAVIGATION_JSON, existing)


def store_seo(records: Iterable[PageRecord]) -> None:
    existing = load_existing_json(SEO_JSON)
    for record in records:
        existing[record.url] = {
            "url": record.url,
            "slug": record.slug,
            "title": record.title,
            "language": record.language,
            "meta": record.meta,
            "sitemap_source": record.sitemap_source,
        }
    store_json_list(SEO_JSON, existing)


def run(limit: Optional[int] = None) -> List[PageRecord]:
    ensure_directories()
    session = create_session()
    asset_cache: Dict[str, Optional[Path]] = {}
    seeds = load_seed_urls(limit=limit)
    records: List[PageRecord] = []
    for url, source_hint in seeds:
        try:
            status, html = fetch_html(url, session)
        except requests.HTTPError as exc:
            print(f"[WARN] HTTP-Fehler beim Abruf {url}: {exc}")
            continue
        except requests.RequestException as exc:
            print(f"[WARN] Netzwerkfehler beim Abruf {url}: {exc}")
            continue

        slug = slugify_url(url)
        raw_path = save_raw_html(slug, html)
        record = build_page_record(url, source_hint, status, html, raw_path, session, asset_cache)
        records.append(record)
        print(f"[OK] {url} -> {record.raw_html_path}")
    return records


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wine Academy Content Crawler")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Anzahl der zu verarbeitenden URLs (Standard: alle).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    records = run(limit=args.limit)
    if not records:
        print("Keine Datensätze erstellt.")
        return
    store_records(records)
    store_navigation(records)
    store_seo(records)
    print(f"Gespeicherte Datensätze: {len(records)} -> {CONTENT_JSON}")
    print(f"Navigation aktualisiert: {NAVIGATION_JSON}")
    print(f"SEO-Daten aktualisiert: {SEO_JSON}")


if __name__ == "__main__":
    main()
