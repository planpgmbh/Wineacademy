#!/usr/bin/env python3
"""
Erstellt ein Manifest für lokal gespiegelte Assets (SHA256, Dateigröße, MIME-Typ),
damit Upload-Skripte die Dateien eindeutig identifizieren und in Strapi hochladen können.

Quelle: `artifacts/crawl/structured/content.json`
Ausgabe: `artifacts/crawl/structured/strapi/assets.json`
"""

import argparse
import hashlib
import json
import mimetypes
from pathlib import Path
from typing import Dict, Iterable, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_JSON = BASE_DIR / "artifacts" / "crawl" / "structured" / "content.json"
ASSET_ROOT = BASE_DIR / "artifacts" / "crawl" / "assets"
OUTPUT_PATH = BASE_DIR / "artifacts" / "crawl" / "structured" / "strapi" / "assets.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Asset-Manifest für Strapi-Uploads erstellen")
    parser.add_argument("--limit", type=int, default=None, help="Optional die Anzahl der Assets begrenzen.")
    parser.add_argument("--dry-run", action="store_true", help="Nur Statistik ausgeben, nichts schreiben.")
    return parser.parse_args()


def load_content() -> List[dict]:
    if not CONTENT_JSON.exists():
        raise FileNotFoundError(f"Content-Datei nicht gefunden: {CONTENT_JSON}")
    with CONTENT_JSON.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("content.json enthält keine Liste.")
    return data


def iter_asset_entries(content: Iterable[dict]) -> Iterable[Dict[str, Optional[str]]]:
    for entry in content:
        assets = entry.get("assets", {})
        for asset_type, asset_list in assets.items():
            if not isinstance(asset_list, list):
                continue
            for asset in asset_list:
                if isinstance(asset, dict):
                    yield {
                        "type": asset_type,
                        "url": asset.get("url"),
                        "local_path": asset.get("local_path"),
                        "source_url": entry.get("url"),
                    }


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def build_manifest(limit: Optional[int] = None) -> List[dict]:
    content = load_content()
    seen: Dict[str, dict] = {}
    count = 0
    for asset in iter_asset_entries(content):
        url = asset.get("url")
        local_path = asset.get("local_path")
        if not url or not local_path:
            continue
        if url in seen:
            seen[url]["references"].append(asset["source_url"])
            continue
        fs_path = BASE_DIR / local_path
        if not fs_path.exists() or not fs_path.is_file():
            continue
        record = {
            "url": url,
            "relative_path": str(fs_path.relative_to(BASE_DIR)),
            "type": asset["type"],
            "size": fs_path.stat().st_size,
            "sha256": compute_sha256(fs_path),
            "mime": mimetypes.guess_type(fs_path.name)[0],
            "filename": fs_path.name,
            "references": [asset["source_url"]],
        }
        seen[url] = record
        count += 1
        if limit is not None and count >= limit:
            break
    return list(seen.values())


def main() -> None:
    args = parse_args()
    manifest = build_manifest(limit=args.limit)
    if args.dry_run:
        print(f"[DRY-RUN] Würde Manifest mit {len(manifest)} Assets erzeugen.")
        return
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] Asset-Manifest mit {len(manifest)} Einträgen -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
