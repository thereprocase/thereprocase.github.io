"""Regenerate the glyph tuner's WebP screenshots: python scripts/webp-tuner-screenshots.py

Run this after recapturing public/fillaprint/tuner/*.png (see the walkthrough in
index.html and README.md). It never touches the PNGs or tuner/provenance.json,
which record the actual screenshot capture; it only rewrites the derived WebP
files and tuner/webp-provenance.json, which record that derivation.
"""
import json
import sys
import tempfile
from pathlib import Path

from _webp import make_webp

ROOT = Path(__file__).resolve().parents[1] / "public" / "fillaprint" / "tuner"
SCREENSHOTS = ["tuner-workspace.png", "tuner-points.png", "tuner-validation.png"]


def atomic_write_bytes(dest, data):
    """Write data to dest without ever leaving a partially-written file at that path."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(dest)


def main():
    if len(sys.argv) != 1:
        print(__doc__.splitlines()[0], file=sys.stderr)
        raise SystemExit(2)

    # Convert every screenshot into a scratch directory first. If any one of them
    # fails the savings check, this must not leave the other two updated in ROOT
    # while the third is stale - so nothing below is written to ROOT until every
    # conversion has already succeeded.
    with tempfile.TemporaryDirectory(prefix="fillaprint-tuner-webp-") as staging_dir:
        staging = Path(staging_dir)
        entries = {}
        for name in SCREENSHOTS:
            webp_name = Path(name).with_suffix(".webp").name
            info = make_webp(ROOT / name, staging / webp_name)
            entries[webp_name] = {"derived_from": name, **info}

        provenance = {
            "note": (
                "WebP siblings of the screenshots in provenance.json, generated in place with "
                "Pillow (quality 82). Purely a format conversion of the same pixels; it does not "
                "change the capture record above."
            ),
            "quality": 82,
            "screenshots": entries,
        }

        for webp_name in entries:
            atomic_write_bytes(ROOT / webp_name, (staging / webp_name).read_bytes())
        atomic_write_bytes(
            ROOT / "webp-provenance.json",
            (json.dumps(provenance, indent=2) + "\n").encode("utf-8"),
        )

    print(f"Regenerated {len(entries)} tuner WebP screenshots.")


if __name__ == "__main__":
    main()
