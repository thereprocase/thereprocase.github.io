"""Sync public font assets: python scripts/sync-brewster.py <font-checkout>."""
import hashlib
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from fontTools.ttLib import TTFont

SOURCE_REVISION = "57599a9"
source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1] / "public" / "brewster-technical"
revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", SOURCE_REVISION], text=True).strip()
assets = {}
mapping = {"OFL.txt": "OFL.txt", "LICENSE.md": "docs/LICENSING.md", "PRINTING.md": "docs/PRINTING.md"}
for name in ["hero.png", "two-bead-rule.png", "labels.png", "6-sliced.png", "2-all-glyphs.png", "3-languages.png", "5-families.png"]:
    mapping[f"images/{name}"] = f"showcase/{name}"
families = {"Brewster": "BrewsterTechnical", "BrewsterTab": "BrewsterTechnicalTab", "BrewsterMono": "BrewsterTechnicalMono"}
for name in families.values():
    mapping[f"fonts/{name}-Regular.ttf"] = f"fonts/{name}-Regular.ttf"
for target, original in mapping.items():
    data = subprocess.check_output(["git", "-C", str(source), "show", f"{revision}:{original}"])
    if target == "LICENSE.md":
        data = data.replace(b"(../OFL.txt)", b"(OFL.txt)")
    dest = root / target
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    assets[target] = {"source": original, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
coverage = {}
for family, name in families.items():
    font = TTFont(root / f"fonts/{name}-Regular.ttf")
    assert font["name"].getDebugName(5) == "Version 1.201"
    assert "SIL OPEN FONT LICENSE" in font["name"].getDebugName(13)
    coverage[family] = sorted(font.getBestCmap())
(root / "coverage.json").write_text(json.dumps(coverage), encoding="utf-8")
install = """Brewster Technical 1.201 — by Repro

Install the three TTF files with your operating system's font installer.
Restart your CAD/design app if needed. Select Brewster Technical, Brewster
Technical Tab (equal-width digits), or Brewster Technical Mono.

At extrusion line width w, capital height = 14w; em size = 20w.
For w = 0.42 mm, start with 5.88 mm capitals (Fusion Height) / 8.40 mm em.
Inspect the sliced preview before printing.

Free for personal and commercial use under SIL OFL 1.1. Retain the license
and copyright notices when distributing fonts. Modified font versions must
use different names unless permission is granted. See OFL.txt for full terms.

https://thereprocase.github.io/brewster-technical/
https://github.com/thereprocase/double-bead
"""
members = {Path(p).name: (root / p).read_bytes() for p in mapping if p.startswith("fonts/")}
members.update({"OFL.txt": (root / "OFL.txt").read_bytes(), "INSTALL.txt": install.encode("utf-8")})
bundle = io.BytesIO()
with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(members.items()):
        info = zipfile.ZipInfo(f"BrewsterTechnical-1.201/{name}", (2026, 9, 25, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
target = root / "downloads" / "BrewsterTechnical-1.201.zip"
target.parent.mkdir(exist_ok=True)
target.write_bytes(bundle.getvalue())
assets["downloads/" + target.name] = {"bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
(root / "provenance.json").write_text(json.dumps({"font_version": "1.201", "source": "https://github.com/thereprocase/double-bead", "revision": revision, "assets": assets}, indent=2) + "\n", encoding="utf-8")
print(f"Synced {len(mapping)} assets and font bundle from {revision}")
