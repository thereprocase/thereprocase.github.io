"""Build the capital V and Z candidate sheet on the Fillaprint page (section 13, #vz-capital-candidates).

Run it with the font repository's pinned environment, from this repository's root:

    <font-checkout>/.venv/bin/python scripts/build-fillaprint-VZ-capital-candidates.py <font-checkout>

Each candidate is ordinary glyph source in the font's own notation. It is finished with the font's
geom.finish, checked with its verify module, placed into a rebuilt proportional family (so accented
letters are composed from it and kerning is computed for it), and set in sample words. Nothing is
written to the font repository. Output: public/fillaprint/candidates/vz-caps/ (SVGs, candidates.json) and
the marked region of public/fillaprint/index.html. Copy both to docs/fillaprint/ when publishing.
"""
import argparse
import html
import json
import platform
import subprocess
import sys
from importlib.metadata import version as pkg_version
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "public/fillaprint"
OUT = PAGE / "candidates/vz-caps"
MARK = "VZ-CAPITAL-CANDIDATES"

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("font_checkout", type=Path)
args = parser.parse_args()
FONT = args.font_checkout.resolve()
sys.path.insert(0, str(FONT))

from beadjoint import charset, latin, marks, setting, verify  # noqa: E402
from beadjoint.geom import BALL as B, D, S, Rect, finish, soft, solve  # noqa: E402,F401
from beadjoint.latin import diagonal  # noqa: E402,F401

SAMPLES = {"V": "VIVID VAULT Vex", "Z": "ZINC HAZE Zulu ŹŻŽ"}


def flush_ends(cl, cr):
    """Bar end positions level with the finished tips of a Z's mitred corners at (cl, top) and (cr, bottom).

    A mitred corner sticks out past its centreline vertex; if the free bar ends stop at the vertex's own x,
    the corner tips overhang them and the bars read short. Finish a Z with short bars and read the tips."""
    tips = finish(S((cr - 2, -3), (cr, -3, 0), (cl, 9, 0), (cl + 2, 9))).bounds
    return round(tips[0], 3), round(tips[2], 3)


def v_source(xl, xr):
    xm = (xl + xr) / 2
    return f"solve(lambda vy: S(({xl}, -3, B), ({xm}, vy)) | S(({xm}, vy), ({xr}, -3, B)) | D(({xm}, vy)), lo=5.0, hi=20)"


def z_source(cl, cr, past=0.0):
    left, right = flush_ends(cl, cr)
    return f"S(({round(left - past, 3)}, -3), ({cr}, -3, 0), ({cl}, 9, 0), ({round(right + past, 3)}, 9))"


def candidates():
    """(id, char, title, note, source) for the current glyphs and each candidate. `source` is the
    constructor exactly as it would go into beadjoint/latin.py; it is evaluated to build the candidate."""
    return [
        ("CV0", "V", "Current V (v0.1.2)",
         "Round point, arm centres 1 to 8: 9w of ink, as wide as N and O.",
         v_source(1, 8)),
        ("CV1", "V", "Half a bead wider",
         "Arm centres 1 to 8.5: 9.5w of ink. The same spread as the lowercase v.",
         v_source(1, 8.5)),
        ("CV2", "V", "One bead wider",
         "Arm centres 1 to 9: 10w of ink, as wide as M and W, and the widest V the Mono cell holds.",
         v_source(1, 9)),
        ("CV3", "V", "One and a half beads wider",
         "Arm centres 1 to 9.5: 10.5w of ink. Wider than the Mono cell allows, so Mono would use CV2.",
         v_source(1, 9.5)),
        ("CV4", "V", "Two beads wider",
         "Arm centres 1 to 10: 11w of ink. Mono would use CV2.",
         v_source(1, 10)),
        ("CZ0", "Z", "Current Z (v0.1.2)",
         "Mitred corners, 65° diagonal. The corner tips stick out 0.6w past the bar ends.",
         "S((0, -3), (6.3, -3, 0), (0.7, 9, 0), (7, 9))"),
        ("CZ1", "Z", "Bars level with the corners",
         "Same diagonal and corners; each bar runs 0.6w further, level with the opposite corner tip. The Z is no wider.",
         z_source(0.7, 6.3)),
        ("CZ2", "Z", "Bars past the corners",
         "Same diagonal; each bar runs 1.1w further, 0.5w past the opposite corner. 1w wider.",
         z_source(0.7, 6.3, 0.5)),
        ("CZ3", "Z", "Wider Z, 61° diagonal",
         "Corners move out 0.5w each, to the lowercase z's lean; bars level with the corner tips. 1.1w wider.",
         z_source(0.2, 6.8)),
        ("CZ4", "Z", "Wider Z, bars past the corners",
         "Corners move out 0.25w each (63°); bars run 0.5w past the corner tips. 1.6w wider.",
         z_source(0.45, 6.55, 0.5)),
    ]


def build(source):
    return eval(source, {"S": S, "D": D, "B": B, "Rect": Rect, "solve": solve, "diagonal": diagonal})


def family_with(char, geom):
    """The finished proportional family and its finishing inputs with `char` replaced."""
    original = latin.capitals
    base = original()
    latin.capitals = lambda: {**base, char: geom}
    charset.cache_clear()
    try:
        glyphs = charset.full_p()
        inputs = charset._assembled_p()[1]
        return glyphs, {c: inputs[c] for c in glyphs}
    finally:
        latin.capitals = original
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
    # build.py holds only the spec sets (lowercase, figures) to R2; capitals are reported, not gated
    spec_thick = verify.stroke_thickness(soft(raw))
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
        "unfilled_stroke_limit_w": None,     # capitals are outside the R2 spec sets
        "min_sample_gap_w": round(min(d for _, _, d in gaps), 3),
        "fits_mono_cell": x1 - x0 <= charset.MONO_MAX + 1e-3,
        "sample": SAMPLES[char],
    }
    result["passes"] = (not result["thin_or_island_failures"] and not fused and thick <= verify.SHIPPED_MAX_T
                        and result["min_sample_gap_w"] >= verify.LINE_MIN and abs(y0 + 4) < 0.02 and abs(y1 - 10) < 0.02)
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
    the current v0.1.2 outline dashed."""
    added = fin.difference(raw)
    grid = "".join(f'<line x1="{x}" y1="-1" x2="{x}" y2="11" />' for x in range(-2, 13, 2)).replace('y1="-1"', 'y1="-5"')
    grid += "".join(f'<line x1="-2.5" y1="{y}" x2="12.5" y2="{y}" />' for y in range(-4, 11, 2))
    ghost_el = (f'<path d="{path_d(ghost)}" fill="none" stroke="{GHOST}" stroke-width="0.06" '
                f'stroke-dasharray="0.25 0.18" />') if ghost is not None else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.5 -5.5 15 17" role="img" '
            f'aria-label="{html.escape(label)}">'
            f'<rect x="-2.5" y="-5.5" width="15" height="17" fill="#FFFFFF" />'
            f'<g stroke="#E8E8E8" stroke-width="0.04">{grid}</g>'
            f'<g stroke="{RULE}" stroke-width="0.05"><line x1="-2.5" y1="-4" x2="12.5" y2="-4" />'
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
    return f"""<article class="vz-card{' vz-current' if cid.endswith('0') else ''}" id="vzc-{cid.lower()}">
<div class="vz-head"><h4>{cid}</h4><span>{html.escape(title)}</span></div>
<img src="candidates/vz-caps/{cid}.svg" width="600" height="680" alt="{html.escape(title)}: construction view of {r['char']} on a 2w grid" loading="lazy">
<img class="vz-sample" src="candidates/vz-caps/{cid}-sample.svg" alt="{html.escape(r['sample'])} set with {cid}" loading="lazy">
<img class="vz-sample vz-small" src="candidates/vz-caps/{cid}-sample.svg" alt="" loading="lazy">
<p>{html.escape(note)}</p>
<dl><div><dt>Finishing fill</dt><dd>{fill:.2f} w²{change}</dd></div><div><dt>Max thickness</dt><dd>{r['max_thickness_w']:.2f} w</dd></div><div><dt>Ink width</dt><dd>{r['ink_width_w']:.2f} w</dd></div><div><dt>Unfilled stroke</dt><dd>{r['unfilled_stroke_w']:.2f} w</dd></div><div><dt>Fits the Mono cell</dt><dd>{'yes' if r['fits_mono_cell'] else 'no (10w max)'}</dd></div><div><dt>Closest pair in sample</dt><dd>{r['min_sample_gap_w']:.2f} w</dd></div></dl>
<p class="vz-status{'' if r['passes'] else ' vz-fail'}">{status} ({html.escape(r['glyphs_checked'])})</p>
<details><summary>Glyph source</summary><pre><code>g["{r['char']}"] = {html.escape(r['source'])}</code></pre></details>
</article>"""


def fragment(results, meta):
    current = {r["char"]: r["added_by_finishing_w2"] for r in results if r["id"].endswith("0")}
    groups = []
    for char, heading in (("V", "Capital V"), ("Z", "Capital Z")):
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
        "purpose": "Capital V and Z candidates for review; not part of any released font.",
        "font_repository": "https://github.com/thereprocase/double-bead",
        "font_revision": rev,
        "font_sources_modified": dirty,
        "platform": f"{platform.system()} {platform.machine()} {' '.join(platform.libc_ver())}",
        "python": platform.python_version(),
        "packages": {p: pkg_version(p) for p in ("shapely", "numpy", "scipy", "fonttools")},
        "units": "w = one extrusion line width; y points down; cap height at y=-4, x-height at y=0, baseline at y=10",
        "candidates": results,
    }
    (OUT / "candidates.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index = PAGE / "index.html"
    index.write_text(replace_marked(index.read_text(encoding="utf-8"), fragment(results, meta)), encoding="utf-8")
    if not all(r["passes"] for r in results):
        raise SystemExit("some candidates fail their checks; see candidates.json")


if __name__ == "__main__":
    main()
