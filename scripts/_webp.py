"""Shared WebP conversion used by sync-fillaprint.py and webp-tuner-screenshots.py.

Kept in one place so both scripts convert with the same quality setting and
enforce the same minimum-savings floor that index.html's <picture> fallbacks
assume.
"""
import hashlib

from PIL import Image

QUALITY = 82
MIN_SAVINGS = 0.30


def make_webp(png_path, webp_path):
    """Write webp_path from png_path and return its size, hash and savings.

    Keeps the alpha channel when the source PNG has one (RGBA/LA, or a
    palette image with a transparency entry) instead of silently flattening
    it onto an opaque background; everything else converts to plain RGB,
    which compresses noticeably better than leaving an unused alpha channel in.
    """
    image = Image.open(png_path)
    has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    image = image.convert("RGBA" if has_alpha else "RGB")
    image.save(webp_path, "WEBP", quality=QUALITY, method=6)

    original = png_path.stat().st_size
    data = webp_path.read_bytes()
    savings = 1 - len(data) / original
    if savings < MIN_SAVINGS:
        raise SystemExit(
            f"{png_path.name}: WebP only saves {savings:.0%}, below the {MIN_SAVINGS:.0%} "
            f"threshold index.html's <picture> fallback assumes"
        )
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "savings_pct": round(savings * 100, 1)}
