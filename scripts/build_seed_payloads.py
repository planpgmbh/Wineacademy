#!/usr/bin/env python3
"""Erzeugt Seed-Daten für Kategorien und Seminare aus den Export-Artefakten."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
EXPORT_CATEGORIES_DIR = BASE_DIR / "artifacts" / "export" / "kategorien"
EXPORT_SEMINARS_DIR = BASE_DIR / "artifacts" / "export" / "seminare"
SEED_CATEGORIES_DIR = BASE_DIR / "backend" / "src" / "seeds" / "kategorien"
SEED_SEMINARS_DIR = BASE_DIR / "backend" / "src" / "seeds" / "seminare"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def normalise_seo(data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(data, dict):
        return None
    result = {
        "title": data.get("title") or None,
        "description": data.get("description") or None,
        "canonical": data.get("canonical") or None,
        "robots": data.get("robots") or None,
        "og_image": data.get("og_image") or None,
    }
    if all(value is None for value in result.values()):
        return None
    return result


def write_json(path: Path, data: Dict[str, Any]) -> None:
    # Entferne explizit None-Werte, um die Dateien schlank zu halten.
    def compact(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: compact(v) for k, v in value.items() if v is not None}
        if isinstance(value, list):
            return [compact(item) for item in value if item is not None]
        return value

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(compact(data), handle, ensure_ascii=False, indent=2)


def build_category_seed(export_path: Path) -> Dict[str, Any]:
    raw = json.loads(export_path.read_text(encoding="utf-8"))
    name = raw.get("name") or "Kategorie"
    slug = raw.get("slug") or slugify(name)
    seed = {
        "name": name,
        "slug": slug,
        "beschreibung": raw.get("beschreibung") or None,
        "kurzbeschreibung": raw.get("kurzbeschreibung") or None,
        "heroDarkMode": raw.get("heroDarkMode") or False,
        "seo": normalise_seo(raw.get("seo")),
    }
    return seed


def build_seminar_seed(export_path: Path) -> Dict[str, Any]:
    raw = json.loads(export_path.read_text(encoding="utf-8"))
    name = raw.get("name") or "Seminar"
    slug = raw.get("slug") or slugify(name)

    bookingbox_raw = raw.get("bookingbox")
    bookingbox = None
    if isinstance(bookingbox_raw, dict):
        bookingbox = {
            "topline": bookingbox_raw.get("topline") or None,
            "headline": bookingbox_raw.get("headline") or None,
            "body": bookingbox_raw.get("body") or None,
        }
        if all(value is None for value in bookingbox.values()):
            bookingbox = None

    seminartabs = []
    for tab in raw.get("seminarinhalte") or []:
        titel = tab.get("titel")
        inhalt = tab.get("inhalt")
        if isinstance(titel, str) and titel.strip():
            seminartabs.append({
                "titel": titel.strip(),
                "inhalt": inhalt or "",
            })

    kategorien_slugs = []
    for cat in raw.get("kategorien") or []:
        cat_slug = cat.get("slug")
        if isinstance(cat_slug, str) and cat_slug.strip():
            kategorien_slugs.append(cat_slug.strip())
    kategorien_slugs = sorted(set(kategorien_slugs))

    seed = {
        "name": name,
        "slug": slug,
        "kurzbeschreibung": raw.get("kurzbeschreibung") or None,
        "beschreibung": raw.get("beschreibung") or None,
        "preis": raw.get("preis") or None,
        "mwst": raw.get("mwst") if raw.get("mwst") is not None else None,
        "kapazitaet": raw.get("kapazitaet") or None,
        "heroDarkMode": raw.get("heroDarkMode") or False,
        "aktiv": raw.get("aktiv") if raw.get("aktiv") is not None else True,
        "bookingbox": bookingbox,
        "seminarinhalte": seminartabs,
        "seo": normalise_seo(raw.get("seo")),
        "kategorien": kategorien_slugs,
    }
    return seed


def build_seeds() -> None:
    if not EXPORT_CATEGORIES_DIR.exists() or not EXPORT_SEMINARS_DIR.exists():
        raise SystemExit("Export-Verzeichnisse fehlen. Bitte erst die Export-Skripte ausführen.")

    # Kategorien
    for path in sorted(EXPORT_CATEGORIES_DIR.glob("*.json")):
        seed = build_category_seed(path)
        out_path = SEED_CATEGORIES_DIR / path.name
        write_json(out_path, seed)

    # Seminare
    for path in sorted(EXPORT_SEMINARS_DIR.glob("*.json")):
        seed = build_seminar_seed(path)
        out_path = SEED_SEMINARS_DIR / path.name
        write_json(out_path, seed)

    print(f"Kategorien-Seeds aktualisiert: {len(list(EXPORT_CATEGORIES_DIR.glob('*.json')))} Dateien")
    print(f"Seminar-Seeds aktualisiert: {len(list(EXPORT_SEMINARS_DIR.glob('*.json')))} Dateien")


if __name__ == "__main__":
    build_seeds()
