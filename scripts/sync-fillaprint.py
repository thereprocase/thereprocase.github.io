"""Sync public font assets: python scripts/sync-fillaprint.py <font-checkout>."""
import ast
import hashlib
import html
import json
import platform
import re
import subprocess
import sys
import tarfile
import tempfile
import unicodedata
import zipfile
from pathlib import Path

import fontTools
from fontTools.ttLib import TTFont
from PIL import Image

SOURCE_REVISION = "bbcb05d78a27a1f9152e228cf18146133eaaae94"
ROOT = Path(__file__).resolve().parents[1] / "public" / "fillaprint"
FAMILIES = {"Fillaprint": "Fillaprint", "FillaprintTab": "FillaprintTab", "FillaprintMono": "FillaprintMono"}

# Photographic showcase images compress much better as WebP than PNG; the type tester and
# license/artwork screenshots don't (flat UI colour, little to gain), so only these get a
# <picture>+WebP fallback in index.html. WEBP_MIN_SAVINGS guards that assumption: if a future
# asset stops clearing it, fail loudly instead of quietly shipping a fallback that isn't one.
WEBP_TARGETS = ["two-bead-rule.png", "labels.png", "6-sliced.png"]
WEBP_QUALITY = 82
WEBP_MIN_SAVINGS = 0.30


def usage():
    print(__doc__.splitlines()[0], file=sys.stderr)
    raise SystemExit(2)


def git_show(source, revision, path):
    return subprocess.check_output(["git", "-C", str(source), "show", f"{revision}:{path}"])


def copy_assets(source, revision):
    """Copy licensed/showcase/font assets byte-for-byte and record their hashes."""
    assets = {}
    mapping = {"OFL.txt": "OFL.txt", "LICENSE.md": "docs/LICENSING.md", "PRINTING.md": "docs/PRINTING.md"}
    for name in ["hero.png", "two-bead-rule.png", "labels.png", "6-sliced.png", "2-all-glyphs.png", "3-languages.png", "5-families.png"]:
        mapping[f"images/{name}"] = f"showcase/{name}"
    for name in FAMILIES.values():
        mapping[f"fonts/{name}-Regular.ttf"] = f"fonts/{name}-Regular.ttf"
    for target, original in mapping.items():
        data = git_show(source, revision, original)
        if target == "LICENSE.md":
            data = data.replace(b"(../OFL.txt)", b"(OFL.txt)")
        dest = ROOT / target
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        assets[target] = {"source": original, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    for name in WEBP_TARGETS:
        target = f"images/{Path(name).stem}.webp"
        assets[target] = make_webp(ROOT / f"images/{name}")
    return assets


def make_webp(png_path):
    """Write a WebP sibling next to png_path and record its size, hash and savings."""
    webp_path = png_path.with_suffix(".webp")
    Image.open(png_path).convert("RGB").save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
    original = png_path.stat().st_size
    data = webp_path.read_bytes()
    savings = 1 - len(data) / original
    if savings < WEBP_MIN_SAVINGS:
        raise SystemExit(
            f"{png_path.name}: WebP only saves {savings:.0%}, below the {WEBP_MIN_SAVINGS:.0%} "
            f"threshold index.html's <picture> fallback assumes"
        )
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "savings_pct": round(savings * 100, 1)}


def read_font_version_and_coverage():
    """Read the version from each family's name table (ID 5) and its cmap for the specimen page."""
    coverage = {}
    font_version = None
    for family, name in FAMILIES.items():
        font = TTFont(ROOT / f"fonts/{name}-Regular.ttf")
        version_name = font["name"].getDebugName(5) or ""
        match = re.fullmatch(r"Version ([\d.]+)", version_name)
        if not match:
            raise SystemExit(f"{name}: name table ID 5 is {version_name!r}, expected 'Version X.YYY'")
        if font_version is None:
            font_version = match.group(1)
        elif font_version != match.group(1):
            raise SystemExit(f"{name} reports version {match.group(1)}, but {FAMILIES['Fillaprint']} reports {font_version}")
        license_name = font["name"].getDebugName(13) or ""
        if "SIL OPEN FONT LICENSE" not in license_name:
            raise SystemExit(f"{name}: name table ID 13 does not mention the SIL Open Font License")
        coverage[family] = sorted(font.getBestCmap())
    (ROOT / "coverage.json").write_text(json.dumps(coverage), encoding="utf-8")
    return font_version, coverage


def parse_release_constants(source, revision):
    """Read VERSION, RELEASE and BUILD_DATE from beadjoint/release.py without importing it."""
    release_source = git_show(source, revision, "beadjoint/release.py").decode("utf-8")
    tree = ast.parse(release_source, filename="beadjoint/release.py")
    values = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ("VERSION", "RELEASE", "BUILD_DATE"):
                    try:
                        values[target.id] = ast.literal_eval(node.value)
                    except ValueError:
                        values[target.id] = ast.unparse(node.value)
    for name in ("VERSION", "RELEASE", "BUILD_DATE"):
        if name not in values:
            raise SystemExit(f"beadjoint/release.py has no top-level constant named {name}")
    return values


def build_character_specimens(coverage):
    display_names = {"Fillaprint": "Fillaprint", "FillaprintTab": "Fillaprint Tab", "FillaprintMono": "Fillaprint Mono"}
    specimens = []
    for family, codepoints in coverage.items():
        cells = []
        for point in codepoints:
            char = chr(point)
            label = f"U+{point:04X} {unicodedata.name(char, 'UNNAMED')}"
            cells.append(f'<span title="{html.escape(label, quote=True)}">{html.escape(char)}</span>')
        specimens.append(
            f'<div class="character-family"><h3>{display_names[family]}</h3>'
            f'<p class="fine">{len(codepoints)} mapped characters</p>'
            f'<div class="character-sheet" style="font-family:{family}">{"".join(cells)}</div></div>'
        )
    return "\n".join(specimens)


def replace_marked_region(markup, name, replacement, expected_count=None):
    """Replace every '<!-- NAME:START -->...<!-- NAME:END -->' span, like the CHARACTER-SET markers."""
    start, end = f"<!-- {name}:START -->", f"<!-- {name}:END -->"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    markup, count = pattern.subn(start + replacement + end, markup)
    if count == 0:
        raise SystemExit(f"No {name} markers found in index.html")
    if expected_count is not None and count != expected_count:
        raise SystemExit(f"Expected {expected_count} {name} markers in index.html, found {count}")
    return markup


def replace_attribute_pattern(markup, pattern, replacement, expected_count):
    """Replace a fixed-shape attribute value (hrefs can't hold HTML comment markers)."""
    markup, count = re.subn(pattern, replacement, markup)
    if count != expected_count:
        raise SystemExit(f"Expected {expected_count} matches for {pattern!r} in index.html, found {count}")
    return markup


def update_index_html(coverage, release_label):
    page = ROOT / "index.html"
    markup = page.read_text(encoding="utf-8")

    markup = replace_marked_region(markup, "CHARACTER-SET", "\n" + build_character_specimens(coverage) + "\n")

    badge = f"V{release_label.upper()}"
    markup = replace_marked_region(markup, "RELEASE-BADGE", badge, expected_count=3)
    markup = replace_marked_region(markup, "RELEASE-NOTE", f"v{release_label}", expected_count=1)

    slug = release_label.replace(" ", "-")
    version_number = release_label.split()[0]
    markup = replace_attribute_pattern(
        markup, r'downloads/Fillaprint-[\d.]+-[a-z]+\.zip', f"downloads/Fillaprint-{slug}.zip", expected_count=2
    )
    markup = replace_attribute_pattern(
        markup, r'releases/tag/v[\d.]+', f"releases/tag/v{version_number}", expected_count=1
    )

    page.write_text(markup, encoding="utf-8")
    return slug


def build_release_zip(source, revision, slug):
    """Run the font repo's own package_release.py against an exported copy of the pinned revision.

    package_release.py is deterministic (fixed dates, ZIP_STORED, sorted members), so it doesn't
    matter which Python runs it or whether it comes from a worktree or a plain export; the bytes
    it produces are the same either way. A plain `git archive` export is the cheaper of the two
    options the contract allows, so that's what this uses.
    """
    with tempfile.TemporaryDirectory(prefix="fillaprint-release-") as tmp:
        tmp = Path(tmp)
        archive = tmp / "source.tar"
        subprocess.check_call(["git", "-C", str(source), "archive", "--format=tar", "-o", str(archive), revision])
        checkout = tmp / "checkout"
        checkout.mkdir()
        with tarfile.open(archive) as tar:
            tar.extractall(checkout, filter="data")
        out_dir = tmp / "out"
        out_dir.mkdir()
        result = subprocess.run(
            [sys.executable, str(checkout / "tools" / "package_release.py"), "--out", str(out_dir)],
            capture_output=True, text=True, check=True,
        )
        produced = sorted(out_dir.glob("Fillaprint-*.zip"))
        if len(produced) != 1:
            raise SystemExit(f"Expected package_release.py to write one Fillaprint-*.zip to {out_dir}, found {produced}")
        zip_path = produced[0]
        printed = result.stdout.strip().split()
        if len(printed) != 2:
            raise SystemExit(f"Expected 'package_release.py' to print '<path> <sha256>', got: {result.stdout!r}")
        printed_path, printed_sha = printed
        actual_sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
        if actual_sha != printed_sha:
            raise SystemExit(f"package_release.py printed {printed_sha} but {zip_path} hashes to {actual_sha}")
        if not zip_path.name.startswith(f"Fillaprint-{slug}"):
            raise SystemExit(f"Release zip {zip_path.name} does not match the release label {slug!r} from beadjoint/release.py")

        downloads = ROOT / "downloads"
        downloads.mkdir(exist_ok=True)
        for stale in downloads.glob("Fillaprint-*.zip"):
            stale.unlink()
        dest = downloads / zip_path.name
        dest.write_bytes(zip_path.read_bytes())

        with zipfile.ZipFile(dest) as zf:
            members = {name: hashlib.sha256(zf.read(name)).hexdigest() for name in zf.namelist()}
        return dest, members


def main():
    if len(sys.argv) != 2:
        usage()
    source = Path(sys.argv[1]).resolve()
    revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", SOURCE_REVISION], text=True).strip()

    assets = copy_assets(source, revision)
    font_version, coverage = read_font_version_and_coverage()
    release = parse_release_constants(source, revision)
    if release["VERSION"] != font_version:
        raise SystemExit(f"beadjoint/release.py VERSION is {release['VERSION']!r}, but the fonts report {font_version!r}")

    slug = update_index_html(coverage, release["RELEASE"])
    zip_path, members = build_release_zip(source, revision, slug)
    assets[f"downloads/{zip_path.name}"] = {
        "bytes": zip_path.stat().st_size,
        "sha256": hashlib.sha256(zip_path.read_bytes()).hexdigest(),
        "members": members,
    }

    provenance = {
        "font_version": font_version,
        "release": release["RELEASE"],
        "build_date": release["BUILD_DATE"],
        "source": "https://github.com/thereprocase/double-bead",
        "revision": revision,
        "tools": {
            "python": platform.python_version(),
            "fonttools": fontTools.__version__,
        },
        "assets": assets,
    }
    (ROOT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(assets)} assets and release {release['RELEASE']} from {revision}")


if __name__ == "__main__":
    main()
