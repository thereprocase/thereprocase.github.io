"""Build the lowercase v and z candidate sheet on the Fillaprint page (section 12, #vz-candidates).

Run it with the font repository's pinned environment, from this repository's root:

    <font-checkout>/.venv/bin/python scripts/build-fillaprint-vz-candidates.py <font-checkout>

Each candidate is ordinary glyph source in the font's own notation. It is finished with the font's
geom.finish, checked with its verify module, placed into a rebuilt proportional family (so accented
letters are composed from it and kerning is computed for it), and set in sample words. Nothing is
written to the font repository. Output: public/fillaprint/candidates/vz/ (SVGs, candidates.json) and
the marked region of public/fillaprint/index.html. Copy both to docs/fillaprint/ when publishing.
"""
import argparse
import html
import json
import math
import platform
import subprocess
import sys
from importlib.metadata import version as pkg_version
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "public/fillaprint"
OUT = PAGE / "candidates/vz"
MARK = "VZ-CANDIDATES"

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("font_checkout", type=Path)
args = parser.parse_args()
FONT = args.font_checkout.resolve()
sys.path.insert(0, str(FONT))

from beadjoint import charset, marks, setting, verify  # noqa: E402
from beadjoint import glyphs as spec  # noqa: E402
from beadjoint.geom import BALL as B, D, S, Rect, finish, soft, solve  # noqa: E402,F401
from beadjoint.latin import diagonal  # noqa: E402,F401

SAMPLES = {"v": "vivid valve vex", "z": "lazy zinc fizz źżž"}


def cut_vertex(xl, xr, foot):
    """Centreline vertex depth for a mitred v whose point, cut flat on the baseline, leaves `foot` w.

    The outer edges of two 2w arms meet 1/sin(a) below the centreline vertex, a being the half-angle;
    the cut then leaves 2 * (depth past the baseline) * tan(a). The angle depends on the depth, so iterate."""
    xm, vy = (xl + xr) / 2, 9.0
    for _ in range(60):
        a = math.atan2(xm - xl, vy - 1)
        vy = 10 - 1 / math.sin(a) + foot / (2 * math.tan(a))
    return round(vy, 3)


def knife_vertex(xl, xr):
    """Centreline vertex depth that puts a mitred v's finished point on the baseline. Finishing trims
    the raw mitre tip, so bisect against the finished outline (solve() returns geometry, not depth)."""
    xm = (xl + xr) / 2
    lo, hi = 5.0, 12.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if finish(S((xl, 1, B), (xm, mid, 0), (xr, 1, B))).bounds[3] > 10:
            hi = mid
        else:
            lo = mid
    return round((lo + hi) / 2, 3)


def candidates():
    """(id, char, title, note, source) for the current glyphs and each candidate. `source` is the
    constructor exactly as it would go into beadjoint/glyphs.py; it is evaluated to build the candidate."""
    v2, v3 = cut_vertex(1, 8, 1.0), cut_vertex(1, 8.5, 1.0)
    k3 = round((4.75 - 1) / (v3 - 1), 4)                # V3's arm slope, to run the arms up past the x-height
    v5 = knife_vertex(1, 9)
    return [
        ("V0", "v", "Current v (v0.1.1)",
         "Arms meet in a 1w centreline fillet, so the point is a 2w-radius curve.",
         "solve(lambda vy: S((1, 1, B), (4, vy), (7, 1, B)))"),
        ("V1", "v", "Tighter curve, same width",
         "Fillet 0.7w: the tightest that keeps the unfilled stroke within two beads (2.85w) at today's angle.",
         "solve(lambda vy: S((1, 1, B), (4, vy, 0.7), (7, 1, B)), lo=5.0)"),
        ("V2", "v", "Cut point, 8w spread",
         "A mitred point cut flat on the baseline, 1.0w wide. 8w between arm centres is the narrowest spread where a cut point stays within two beads.",
         f"S((1, 1, B), (4.5, {v2}, 0), (8, 1, B)).intersection(Rect(-5, -5, 20, 10))"),
        ("V3", "v", "Cut point, cut tops",
         "Cut 1.0w point at an 8.5w spread, with the arm ends cut flat on the x-height like the capitals' diagonals.",
         f"S((1 - {k3} * 3, -2), (4.75, {v3}, 0), (8.5 + {k3} * 3, -2)).intersection(Rect(-5, 0, 20, 10))"),
        ("V4", "v", "Round point, 8.5w spread",
         "Arms meet in a plain round join (the stroke's own 1w radius). At a narrower spread this join is thicker than two beads.",
         "solve(lambda vy: S((1, 1, B), (4.75, vy)) | S((4.75, vy), (8.5, 1, B)) | D((4.75, vy)), lo=5.0)"),
        ("V5", "v", "Knife point",
         "A true mitred point. It passes only at this width (10w ink, as wide as m); narrower, the tip is thin ink.",
         f"S((1, 1, B), (5, {v5}, 0), (9, 1, B))"),
        ("Z0", "z", "Current z (v0.1.1)",
         "Diagonal at 55°. Corners filleted 0.8w on the centreline (1.8w outside radius).",
         "S((0, 1), (6.3, 1, 0.8), (0.7, 9, 0.8), (7, 9))"),
        ("Z1", "z", "Round corners, same lean",
         "Same 55° diagonal. Corners are the stroke's own 1w radius. Sharper corners, but slightly more fill in the notches.",
         "S((0, 1), (6.3, 1)) | S((6.3, 1), (0.7, 9)) | S((0.7, 9), (7, 9)) | D((6.3, 1)) | D((0.7, 9))"),
        ("Z2", "z", "Mitred corners, 58°",
         "Sharp mitred corners. At 55° they fail the thin-ink check; 58° is the first lean that passes.",
         "S((0, 1), (6.0, 1, 0), (1.0, 9, 0), (7, 9))"),
        ("Z3", "z", "Mitred corners, 61°",
         "Steeper diagonal. The notch under each bar falls below the 0.5 w² fill tolerance, so finishing leaves it open.",
         "S((0, 1), (5.7, 1, 0), (1.3, 9, 0), (7, 9))"),
        ("Z4", "z", "Mitred corners, 65°",
         "The capital Z's lean. Corners land inside the bar ends.",
         "S((0, 1), (5.4, 1, 0), (1.6, 9, 0), (7, 9))"),
        ("Z5", "z", "Square bar ends, 67°",
         "Full-width bars with square ends; the diagonal is cut flat on the bars' outer edges, like N.",
         "S((0, 1), (7, 1)) | S((0, 9), (7, 9)) | diagonal(5.2, 1, 1.8, 9, clip=(0, 10))"),
    ]


def build(source):
    return eval(source, {"S": S, "D": D, "B": B, "Rect": Rect, "solve": solve, "diagonal": diagonal})


def family_with(char, geom):
    """The finished proportional family and its finishing inputs with `char` replaced."""
    original = spec._raw_p
    base = original()
    spec._raw_p = lambda: {**base, char: geom}
    charset.cache_clear()
    try:
        glyphs = charset.full_p()
        inputs = charset._assembled_p()[1]
        return glyphs, {c: inputs[c] for c in glyphs}
    finally:
        spec._raw_p = original
        charset.cache_clear()


def derived(char):
    out = []
    for c in charset.CHARS:
        dec = marks.decompose(c)
        if dec and dec[0] == char:
            out.append(c)
    return out


def measure(cid, char, source):
    raw = build(source)
    glyphs, inputs = family_with(char, raw)
    fin = glyphs[char].geom
    affected = [char] + derived(char)
    checks = {c: verify.check_glyph(glyphs[c].geom) for c in affected}
    fused = verify.fused_pieces({c: glyphs[c] for c in affected}, inputs)
    line = setting.kerned(SAMPLES[char], glyphs)
    gaps = verify.line_gaps([(c, g) for c, g, _ in line])
    thick = verify.stroke_thickness(fin)
    spec_thick = verify.stroke_thickness(soft(raw))     # build.py's spec-set rule R2, before joints are filled
    x0, y0, x1, y1 = fin.bounds
    result = {
        "id": cid, "char": char, "source": source,
        "added_by_finishing_w2": round(fin.difference(raw).area, 2),
        "max_thickness_w": round(thick, 2),
        "ink_width_w": round(x1 - x0, 2),
        "ink_top_bottom_w": [round(y0, 3), round(y1, 3)],
        "glyphs_checked": "".join(affected),
        "thin_or_island_failures": [c for c, r in checks.items() if not r["ok"]],
        "fused": sorted(fused),
        "thickness_limit_w": verify.SHIPPED_MAX_T,
        "unfilled_stroke_w": round(spec_thick, 3),
        "unfilled_stroke_limit_w": verify.MAX_T,
        "min_sample_gap_w": round(min(d for _, _, d in gaps), 3),
        "sample": SAMPLES[char],
    }
    result["passes"] = (not result["thin_or_island_failures"] and not fused and thick <= verify.SHIPPED_MAX_T
                        and spec_thick <= verify.MAX_T
                        and result["min_sample_gap_w"] >= verify.LINE_MIN and abs(y0) < 0.02 and abs(y1 - 10) < 0.02)
    return result, raw, fin, line


# --- SVG ---------------------------------------------------------------------------------------

BLUE, AMBER, GHOST, RULE = "#0000A8", "#B87900", "#101010", "#9A9A9A"


def path_d(geom):
    polys = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    parts = []
    for p in polys:
        if p.is_empty or p.geom_type != "Polygon":
            continue
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            parts.append("M" + " L".join(f"{x:.3f} {y:.3f}" for x, y in pts[:-1]) + " Z")
    return " ".join(parts)


def glyph_svg(fin, raw, ghost, label):
    """Construction view in w units, y down: finished ink in blue, the part finishing added in amber,
    the current v0.1.1 outline dashed."""
    added = fin.difference(raw)
    grid = "".join(f'<line x1="{x}" y1="-1" x2="{x}" y2="11" />' for x in range(-2, 13, 2))
    grid += "".join(f'<line x1="-2.5" y1="{y}" x2="12.5" y2="{y}" />' for y in range(0, 11, 2))
    ghost_el = (f'<path d="{path_d(ghost)}" fill="none" stroke="{GHOST}" stroke-width="0.06" '
                f'stroke-dasharray="0.25 0.18" />') if ghost is not None else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.5 -1.5 15 13" role="img" '
            f'aria-label="{html.escape(label)}">'
            f'<rect x="-2.5" y="-1.5" width="15" height="13" fill="#FFFFFF" />'
            f'<g stroke="#E8E8E8" stroke-width="0.04">{grid}</g>'
            f'<g stroke="{RULE}" stroke-width="0.05"><line x1="-2.5" y1="0" x2="12.5" y2="0" />'
            f'<line x1="-2.5" y1="10" x2="12.5" y2="10" /></g>'
            f'<path d="{path_d(fin)}" fill="{BLUE}" fill-rule="evenodd" />'
            f'<path d="{path_d(added)}" fill="{AMBER}" fill-rule="evenodd" />'
            f'{ghost_el}</svg>\n')


def line_svg(line, label):
    from shapely.ops import unary_union
    ink = unary_union([g for _, g, _ in line])
    x0, y0, x1, y1 = ink.bounds
    pad = 1.0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0 - pad:.3f} {y0 - pad:.3f} '
            f'{x1 - x0 + 2 * pad:.3f} {y1 - y0 + 2 * pad:.3f}" role="img" aria-label="{html.escape(label)}">'
            f'<path d="{path_d(ink)}" fill="#101010" fill-rule="evenodd" /></svg>\n')


# --- page fragment ----------------------------------------------------------------------------

def card(r, title, note, current):
    cid = r["id"]
    base = current[r["char"]]
    fill = r["added_by_finishing_w2"]
    change = "" if cid.endswith("0") else f" ({(fill - base) / base * 100:+.0f}%)"
    status = "Passes the build's glyph checks" if r["passes"] else "FAILS: " + ", ".join(
        r["thin_or_island_failures"] + r["fused"])
    return f"""<article class="vz-card{' vz-current' if cid.endswith('0') else ''}" id="vz-{cid.lower()}">
<div class="vz-head"><h4>{cid}</h4><span>{html.escape(title)}</span></div>
<img src="candidates/vz/{cid}.svg" width="600" height="520" alt="{html.escape(title)}: construction view of {r['char']} on a 2w grid" loading="lazy">
<img class="vz-sample" src="candidates/vz/{cid}-sample.svg" alt="{html.escape(r['sample'])} set with {cid}" loading="lazy">
<img class="vz-sample vz-small" src="candidates/vz/{cid}-sample.svg" alt="" loading="lazy">
<p>{html.escape(note)}</p>
<dl><div><dt>Finishing fill</dt><dd>{fill:.2f} w²{change}</dd></div><div><dt>Max thickness</dt><dd>{r['max_thickness_w']:.2f} w</dd></div><div><dt>Ink width</dt><dd>{r['ink_width_w']:.2f} w</dd></div><div><dt>Unfilled stroke (max 2.85)</dt><dd>{r['unfilled_stroke_w']:.2f} w</dd></div><div><dt>Closest pair in sample</dt><dd>{r['min_sample_gap_w']:.2f} w</dd></div></dl>
<p class="vz-status{'' if r['passes'] else ' vz-fail'}">{status} ({html.escape(r['glyphs_checked'])})</p>
<details><summary>Glyph source</summary><pre><code>g["{r['char']}"] = {html.escape(r['source'])}</code></pre></details>
</article>"""


def fragment(results, meta):
    current = {r["char"]: r["added_by_finishing_w2"] for r in results if r["id"].endswith("0")}
    groups = []
    for char, heading in (("v", "Lowercase v"), ("z", "Lowercase z")):
        cards = "\n".join(card(r, *meta[r["id"]], current) for r in results if r["char"] == char)
        groups.append(f'<h3 class="vz-group">{heading}</h3>\n<div class="vz-grid">\n{cards}\n</div>')
    return "\n".join(groups)


def replace_marked(markup, text):
    start, end = f"<!-- {MARK}:START -->", f"<!-- {MARK}:END -->"
    if markup.count(start) != 1 or markup.count(end) != 1:
        raise SystemExit(f"index.html needs exactly one {start} ... {end} region")
    head, rest = markup.split(start)
    _, tail = rest.split(end)
    return f"{head}{start}\n{text}\n{end}{tail}"


def font_revision():
    rev = subprocess.run(["git", "-C", str(FONT), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "-C", str(FONT), "status", "--porcelain", "--", "beadjoint"],
                           capture_output=True, text=True).stdout.strip()
    return rev, bool(dirty)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = candidates()
    meta = {cid: (title, note) for cid, _, title, note, _ in rows}
    results, ghosts = [], {}
    for cid, char, title, note, source in rows:
        r, raw, fin, line = measure(cid, char, source)
        if cid.endswith("0"):
            ghosts[char] = fin
        (OUT / f"{cid}.svg").write_text(glyph_svg(fin, raw, None if cid.endswith("0") else ghosts[char],
                                                  f"{cid} {title}"), encoding="utf-8")
        (OUT / f"{cid}-sample.svg").write_text(line_svg(line, f"{r['sample']} set with {cid}"), encoding="utf-8")
        results.append(r)
        print(f"{cid}: fill {r['added_by_finishing_w2']:.2f} w2, thickness {r['max_thickness_w']:.2f}, "
              f"width {r['ink_width_w']:.2f}, gap {r['min_sample_gap_w']:.2f}, passes {r['passes']}")
    rev, dirty = font_revision()
    record = {
        "purpose": "Lowercase v and z candidates for review; not part of any released font.",
        "font_repository": "https://github.com/thereprocase/double-bead",
        "font_revision": rev,
        "font_sources_modified": dirty,
        "platform": f"{platform.system()} {platform.machine()} {' '.join(platform.libc_ver())}",
        "python": platform.python_version(),
        "packages": {p: pkg_version(p) for p in ("shapely", "numpy", "scipy", "fonttools")},
        "units": "w = one extrusion line width; y points down; x-height at y=0, baseline at y=10",
        "candidates": results,
    }
    (OUT / "candidates.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index = PAGE / "index.html"
    index.write_text(replace_marked(index.read_text(encoding="utf-8"), fragment(results, meta)), encoding="utf-8")
    if not all(r["passes"] for r in results):
        raise SystemExit("some candidates fail their checks; see candidates.json")


if __name__ == "__main__":
    main()
