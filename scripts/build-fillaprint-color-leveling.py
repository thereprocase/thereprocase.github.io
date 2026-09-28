"""Build the Fillaprint color-leveling page (public/fillaprint/color/).

Run it with the font repository's pinned environment, from this repository's root:

    <font-checkout>/.venv/bin/python scripts/build-fillaprint-color-leveling.py <font-checkout>

Typographic color is how dark a letter reads. Here it is measured on the finished outlines: blur the
glyph with a Gaussian of sigma 1.5w (roughly how a joint reads at label size) and take the darkest spot.
The leveled font is the font checkout's HEAD with the source edits in EDITS applied: exported with
git archive into a temporary directory, rebuilt with its own build.py (which must pass), and measured
beside the checkout's committed fonts. Nothing is written to the font repository.

Output: public/fillaprint/color/ (index.html, SVGs, squint.png, color.json, the leveled TTFs renamed
"Fillaprint Leveled" so they install beside the released fonts). Copy it to docs/fillaprint/color/ when
publishing.
"""
import argparse
import html
import json
import platform
import subprocess
import sys
import tempfile
from importlib.metadata import version as pkg_version
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/fillaprint/color"

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("font_checkout", type=Path)
args = parser.parse_args()
FONT = args.font_checkout.resolve()

SIGMA_W = 1.5          # blur, in extrusion widths
UNITS_PER_W = 50       # the fonts' 1000-unit em is 20w
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

# (file, current source, leveled source, what changed). Each current source must occur exactly once.
EDITS = [
    ("beadjoint/latin.py",
     'c["K"] = S((1, -4), (1, 10)) | S((6.5, -3, B), (2.5, 3), (6.5, 9, B))',
     'c["K"] = S((1, -4), (1, 10)) | S((1, 3), (4.5, 3)) | S((6.5, -3, B), (4.5, 3, 0), (6.5, 9, B))',
     "K: the arms meet on a 3.5w spur instead of at the stem, so no arm meets the stem at an acute angle."),
    ("beadjoint/glyphs.py",
     'g["k"] = S((1, -4), (1, 10)) | S((6, 1, B), (2.5, 6), (6.5, 9, B))',
     'g["k"] = S((1, -4), (1, 10)) | S((1, 5), (4.5, 5)) | S((6, 1, B), (4.5, 5, 0), (6.5, 9, B))',
     "k: the same spur, on the x-height's middle bar line."),
    ("beadjoint/glyphs.py",
     'g["k"] = S((1, -4), (1, 10)) | S((8, 1, B), (2.5, 6), (8.5, 9, B))',
     'g["k"] = S((1, -4), (1, 10)) | S((1, 5), (5, 5)) | S((8, 1, B), (5, 5, 0), (8.5, 9, B))',
     "Mono k: the same spur in the 12w cell. The arm no longer stops just short of the stem, so Mono's k "
     "is no longer the font's one designed join (verify.FUSED_BY_DESIGN below)."),
    ("beadjoint/verify.py",
     'FUSED_BY_DESIGN = {"M": frozenset("k")}',
     'FUSED_BY_DESIGN = {}',
     "No designed joins remain."),
    ("beadjoint/latin.py",
     'c["R"] = c["P"] | S((3.5, 3), (6.5, 9, B))',
     'c["R"] = c["P"] | S((4.5, 3), (7, 9, B))',
     "R: the leg starts 1w further right, leaving a full 2w gap under the bowl."),
    ("beadjoint/latin.py",
     'v = S((0.293, -5.834), (5, 5, 2), (9.707, -5.834)).intersection(Rect(-20, -4, 40, 10))',
     'v = S((-0.249, -5.562), (5, 1, 3), (10.249, -5.562)).intersection(Rect(-20, -4, 40, 10))',
     "M (and W, which is M turned over): the V is shallower (its point 4w higher) with a 3w hairpin, "
     "so the arms leave the stems at a wider angle."),
    ("beadjoint/latin.py",
     'c["N"] = S((1, 10), (1, -4)) | S((8, -4), (8, 10)) | diagonal(1.111, -4, 7.889, 10)',
     'c["N"] = S((1, 10), (1, -4)) | S((9, -4), (9, 10)) | diagonal(1.111, -4, 8.889, 10)',
     "N: 1w wider (10w, like M and W). This only partly levels it; see below."),
]

# Tests that pin the v0.1.3 shapes these edits change by design: (test id, why it fails). Any other
# failure stops the build of this page.
EXPECTED_TEST_FAILURES = {
    "test_tuner.CatalogStructure.test_diagonals_are_exposed":
        "pins N's diagonal at its 9w position (1.111, -4, 7.889, 10); the leveled N's is 8.889.",
    "test_tuner.WorkerRuns.test_cache_hits_keep_their_fill":
        "uses Ń as a glyph with more than 5 w² of fill; the leveled N carries 4.86.",
    "test_tuner.WorkerRuns.test_pieces_joined_by_finishing_fail_as_in_the_build":
        "edits the arm of Mono's old k to test its designed join; the spur k has no designed join.",
}

# Characters shown as cards: (family, char, heading)
CARDS = [("P", "K", "Capital K"), ("P", "k", "Lowercase k"), ("M", "k", "Mono k"), ("P", "R", "Capital R"),
         ("P", "M", "Capital M"), ("P", "W", "Capital W"), ("P", "N", "Capital N")]
SAMPLES = {"K": "KINK RACK Kilo", "k": "kink rack kilo", "R": "RACK RIVER Rex", "M": "MAKE MEMO Mix",
           "W": "WORK WAVE Wax", "N": "NORTH NINE Nun"}
SQUINT_LINES = ["NORTH WALL RACK M4", "MAKE NEW WORK KITS", "Knob kit, work bench K2"]

# The colour meter, shared by both probes: rasterize at PX per w, blur by SIGMA w, take the darkest value.
PEAK_CODE = r'''
SIGMA, PX, PAD = float(sys.argv[2]), 8, 6
r = int(3 * SIGMA * PX)
K = np.exp(-0.5 * (np.arange(-r, r + 1) / (SIGMA * PX)) ** 2); K /= K.sum()

def peak(geom):
    x0, y0, x1, y1 = geom.bounds
    im = Image.new("L", (int((x1 - x0 + 2 * PAD) * PX), int((y1 - y0 + 2 * PAD) * PX)), 0)
    d = ImageDraw.Draw(im)
    tx = lambda cs: [((x - x0 + PAD) * PX, (y - y0 + PAD) * PX) for x, y in cs]
    for p in (geom.geoms if hasattr(geom, "geoms") else [geom]):
        d.polygon(tx(p.exterior.coords), fill=255)
        for h in p.interiors:
            d.polygon(tx(h.coords), fill=0)
    a = np.asarray(im, float) / 255
    a = np.apply_along_axis(lambda v: np.convolve(v, K, "same"), 1, a)
    a = np.apply_along_axis(lambda v: np.convolve(v, K, "same"), 0, a)
    iy, ix = np.unravel_index(np.argmax(a), a.shape)
    return round(float(a[iy, ix]), 3), [round(x0 - PAD + ix / PX, 1), round(y0 - PAD + iy / PX, 1)]

'''

# Measured in a subprocess per checkout: both checkouts are a package named beadjoint.
PROBE = r'''
import json, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[1])
from beadjoint import charset, setting, verify
from fontTools.ttLib import TTFont
from shapely.ops import unary_union
''' + PEAK_CODE + r'''
chars, cards, samples = sys.argv[3], json.loads(sys.argv[4]), json.loads(sys.argv[5])
fams = {"P": (charset.full_p(), charset.raw_p(), "Fillaprint"), "M": (charset.full_m(), charset.raw_m(), "FillaprintMono")}
out = {"glyphs": {}, "cards": {}}
for fam, (glyphs, raw, ttf) in fams.items():
    f = TTFont(f"{sys.argv[1]}/fonts/{ttf}-Regular.ttf")
    hm, cmap = f["hmtx"], f.getBestCmap()
    for c in chars:
        g = glyphs[c].geom
        p, at = peak(g)
        out["glyphs"][f"{fam}:{c}"] = {"peak": p, "at": at, "ink_w2": round(g.area, 2),
                                       "advance_w": round(hm[cmap[ord(c)]][0] / 50, 3)}
for fam, c in cards:
    glyphs, raw, _ = fams[fam]
    fin = glyphs[c].geom
    card = {"raw": raw[c].wkt, "fin": fin.wkt, "fill_w2": round(fin.difference(raw[c]).area, 2),
            "max_thickness_w": round(verify.stroke_thickness(fin), 2), "ink_width_w": round(fin.bounds[2] - fin.bounds[0], 2)}
    if fam == "P":
        line = setting.kerned(samples[c], glyphs)
        card["sample"] = unary_union([g for _, g, _ in line]).wkt
        card["min_sample_gap_w"] = round(min(d for _, _, d in verify.line_gaps([(ch, g) for ch, g, _ in line])), 3)
    out["cards"][f"{fam}:{c}"] = card
print(json.dumps(out))
'''

BLUE, AMBER, GHOST, RULE, GREY = "#0000A8", "#B87900", "#101010", "#9A9A9A", "#8A8A8A"


def reference_peaks():
    """Peak darkness of the plain joints every 2w stroke font has: the scale the letters are read against."""
    code = r'''
import json, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[1])
from beadjoint.geom import S, finish
''' + PEAK_CODE + r'''
refs = {"stroke": S((0, -3), (0, 9)), "corner": S((0, -3), (0, 9, 0), (6, 9)),
        "tjoin": S((0, -3), (0, 9)) | S((0, 3), (6, 3)), "crossing": S((0, -3), (0, 9)) | S((-5, 3), (5, 3))}
print(json.dumps({k: peak(finish(g))[0] for k, g in refs.items()}))
'''
    return json.loads(run_py(code, FONT, SIGMA_W))


def run_py(code, *argv):
    r = subprocess.run([sys.executable, "-c", code, *map(str, argv)], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr)
    return r.stdout


def export_leveled(tmp):
    """git archive HEAD of the font checkout into tmp, apply EDITS, rebuild with its build.py."""
    tree = tmp / "font"
    tree.mkdir()
    archive = subprocess.run(["git", "-C", str(FONT), "archive", "HEAD"], capture_output=True, check=True).stdout
    subprocess.run(["tar", "-x", "-C", str(tree)], input=archive, check=True)
    for rel, old, new, _ in EDITS:
        p = tree / rel
        text = p.read_text(encoding="utf-8")
        if text.count(old) != 1:
            raise SystemExit(f"{rel}: expected exactly one {old!r}")
        p.write_text(text.replace(old, new), encoding="utf-8")
    build = subprocess.run([sys.executable, "build.py"], cwd=tree, capture_output=True, text=True)
    if build.returncode:
        raise SystemExit("leveled build failed:\n" + build.stdout[-3000:] + build.stderr[-3000:])
    return tree, build.stdout.strip().splitlines()[-4:]


def run_tests(tree):
    """Run the font's test suite on the leveled tree. Returns (tests run, {failing test id: why})."""
    import re
    r = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests"], cwd=tree,
                       capture_output=True, text=True)
    ran = int(re.search(r"^Ran (\d+) tests?", r.stderr, re.M).group(1))
    failed = re.findall(r"^(?:FAIL|ERROR): \w+ \(([\w.]+)\)", r.stderr, re.M)
    unexpected = [t for t in failed if t not in EXPECTED_TEST_FAILURES]
    if unexpected:
        raise SystemExit("unexpected test failures on the leveled tree: " + ", ".join(unexpected))
    return ran, {t: EXPECTED_TEST_FAILURES[t] for t in failed}


def measure(tree):
    cards = [[fam, c] for fam, c, _ in CARDS]
    return json.loads(run_py(PROBE, tree, SIGMA_W, CHARS, json.dumps(cards), json.dumps(SAMPLES)))


# --- drawings ---------------------------------------------------------------------------------

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


def glyph_svg(fin, raw, ghost, label, at):
    """Construction view in w units, y down: finished ink blue, ink added by finishing amber, the other
    version's outline dashed, and a ring at the darkest spot."""
    added = fin.difference(raw)
    grid = "".join(f'<line x1="{x}" y1="-5" x2="{x}" y2="11" />' for x in range(-2, 13, 2))
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
            f'{ghost_el}<circle cx="{at[0]}" cy="{at[1]}" r="{SIGMA_W}" fill="none" stroke="#D00000" '
            f'stroke-width="0.12" /></svg>\n')


def line_svg(ink, label):
    x0, y0, x1, y1 = ink.bounds
    pad = 1.0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0 - pad:.3f} {y0 - pad:.3f} '
            f'{x1 - x0 + 2 * pad:.3f} {y1 - y0 + 2 * pad:.3f}" role="img" aria-label="{html.escape(label)}">'
            f'<path d="{path_d(ink)}" fill="#101010" fill-rule="evenodd" /></svg>\n')


def chart_svg(cur, lev, refs):
    """Horizontal bars for the darkest letters: current grey, leveled blue, the joint references as lines."""
    keys = sorted((k for k in cur if k.startswith("P:")), key=lambda k: -cur[k]["peak"])[:16]
    lo, hi, x0, width, row = 0.5, 0.9, 70, 560, 26

    def sx(v):
        return x0 + (v - lo) / (hi - lo) * width

    h = 40 + len(keys) * row + 30
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x0 + width + 100} {h}" role="img" '
           f'aria-label="Darkest spot of the sixteen darkest letters, current and leveled" '
           f'font-family="IBM Plex Mono, Consolas, monospace" font-size="13">',
           '<rect width="100%" height="100%" fill="#FFFFFF" />']
    for name, label in (("tjoin", "T-JOIN"), ("crossing", "CROSSING")):
        x = sx(refs[name])
        out.append(f'<line x1="{x:.1f}" y1="24" x2="{x:.1f}" y2="{h - 26}" stroke="{RULE}" stroke-dasharray="4 3" />'
                   f'<text x="{x:.1f}" y="16" text-anchor="middle" fill="#101010">{label} {refs[name]:.2f}</text>')
    for i, k in enumerate(keys):
        y = 36 + i * row
        c = k.split(":")[1]
        a, b = cur[k]["peak"], lev[k]["peak"]
        out.append(f'<text x="{x0 - 14}" y="{y + 12}" text-anchor="end" font-size="16" fill="#101010">{html.escape(c)}</text>'
                   f'<rect x="{x0}" y="{y}" width="{sx(a) - x0:.1f}" height="8" fill="{GREY}" />'
                   f'<rect x="{x0}" y="{y + 9}" width="{sx(b) - x0:.1f}" height="8" fill="{BLUE}" />'
                   f'<text x="{sx(max(a, b)) + 6:.1f}" y="{y + 14}" fill="#101010" font-size="11">'
                   f'{a:.2f}{"" if a == b else f" → {b:.2f}"}</text>')
    for v in (0.5, 0.6, 0.7, 0.8, 0.9):
        out.append(f'<text x="{sx(v):.1f}" y="{h - 8}" text-anchor="middle" fill="{GREY}" font-size="11">{v:.1f}</text>')
    out.append("</svg>\n")
    return "".join(out)


def squint_png(current_ttf, leveled_ttf, threshold, path):
    """The same lines in both fonts, blurred by 1.5w, with every spot darker than a plain crossing in amber.
    Returns the number of such spots in each."""
    from scipy import ndimage
    size = 72                                   # px per em; 1w = size / 20
    sigma = SIGMA_W * size / 20
    counts, panels = [], []
    for ttf in (current_ttf, leveled_ttf):
        font = ImageFont.truetype(str(ttf), size)
        width = max(ImageFont.truetype(str(t), size).getbbox(line)[2] for t in (current_ttf, leveled_ttf) for line in SQUINT_LINES)
        im = Image.new("L", (width + 60, 40 + len(SQUINT_LINES) * 100), 0)
        d = ImageDraw.Draw(im)
        for i, line in enumerate(SQUINT_LINES):
            d.text((30, 20 + i * 100), line, font=font, fill=255)
        a = ndimage.gaussian_filter(np.asarray(im, float) / 255, sigma)
        hot = a > threshold
        counts.append(int(ndimage.label(hot)[1]))
        rgb = np.dstack([255 * (1 - a)] * 3)
        rgb[hot] = (184, 121, 0)
        panels.append(Image.fromarray(rgb.clip(0, 255).astype(np.uint8)))
    w, h = panels[0].size
    sheet = Image.new("RGB", (w, 2 * h + 70), "white")
    d = ImageDraw.Draw(sheet)
    label = ImageFont.truetype(str(current_ttf), 26)
    d.text((30, 8), f"V0.1.3  -  {counts[0]} SPOTS DARKER THAN A CROSSING", font=label, fill=GHOST)
    sheet.paste(panels[0], (0, 36))
    d.text((30, h + 44), f"LEVELED  -  {counts[1]} SPOTS", font=label, fill=BLUE)
    sheet.paste(panels[1], (0, h + 70))
    sheet.save(path, optimize=True)
    return counts


def rename_font(src, dst, family):
    from fontTools.ttLib import TTFont
    f = TTFont(src)
    name = f["name"]
    postscript = family.replace(" ", "") + "-Regular"
    for rec in list(name.names):
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID == 4:
            rec.string = family + " Regular"
        elif rec.nameID == 6:
            rec.string = postscript
        elif rec.nameID == 3:
            rec.string = f"{postscript}; leveling candidate"
    f.save(dst)


# --- page ------------------------------------------------------------------------------------

def card_html(fam, c, heading, cur, lev):
    key = f"{fam}:{c}"
    a, b = cur["glyphs"][key], lev["glyphs"][key]
    ca, cb = cur["cards"][key], lev["cards"][key]
    slug = f"{fam.lower()}-{'upper' if c.isupper() else 'lower'}-{c.lower()}"
    rows = [("Darkest spot", f"{a['peak']:.2f} → {b['peak']:.2f}"), ("Finishing fill", f"{ca['fill_w2']:.2f} → {cb['fill_w2']:.2f} w²"),
            ("Max thickness", f"{ca['max_thickness_w']:.2f} → {cb['max_thickness_w']:.2f} w"),
            ("Ink width", f"{ca['ink_width_w']:.2f} → {cb['ink_width_w']:.2f} w")]
    if "min_sample_gap_w" in cb:
        rows.append(("Closest pair in sample", f"{cb['min_sample_gap_w']:.2f} w"))
    dl = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in rows)
    samples = ""
    if fam == "P":
        samples = "".join(
            f'<img class="vz-sample" src="{slug}-{tag}-sample.svg" alt="{html.escape(SAMPLES[c])}, {name}" loading="lazy">'
            for tag, name in (("current", "v0.1.3"), ("leveled", "leveled")))
        samples += '<p class="fine">Top: v0.1.3. Bottom: leveled.</p>'
    return f"""<article class="vz-card" id="{slug}">
<div class="vz-head"><h4>{html.escape(heading)}</h4><span>{a['peak']:.2f} → {b['peak']:.2f}</span></div>
<div class="color-pair"><figure><img src="{slug}-current.svg" width="600" height="680" alt="{heading}, v0.1.3" loading="lazy"><figcaption>v0.1.3</figcaption></figure>
<figure><img src="{slug}-leveled.svg" width="600" height="680" alt="{heading}, leveled" loading="lazy"><figcaption>Leveled</figcaption></figure></div>
{samples}
<dl>{dl}</dl>
</article>"""


def page(cur, lev, refs, counts, build_tail, tests_html, edits_html, cards_html, not_leveled):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fillaprint — color leveling</title>
<meta name="description" content="Measuring how dark each Fillaprint letter reads, and a leveled candidate for the darkest joints.">
<link rel="canonical" href="https://thereprocase.github.io/fillaprint/color/">
<link rel="stylesheet" href="/gridline/gridline.css"><link rel="stylesheet" href="/gridline/responsive.css"><link rel="stylesheet" href="../style.css?v=20260928-color">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate icon" href="/favicon.ico">
<style>
@font-face{{font-family:"Fillaprint Current";src:url("../fonts/Fillaprint-Regular.ttf") format("truetype")}}
@font-face{{font-family:"Fillaprint Leveled";src:url("fonts/FillaprintLeveled-Regular.ttf") format("truetype")}}
@font-face{{font-family:"Fillaprint Leveled Mono";src:url("fonts/FillaprintLeveledMono-Regular.ttf") format("truetype")}}
@font-face{{font-family:"Fillaprint Current Mono";src:url("../fonts/FillaprintMono-Regular.ttf") format("truetype")}}
.color-tester label{{display:flex;gap:8px;align-items:center;font-size:14px}}.color-tester input[type=text]{{width:100%;font:18px/1.4 var(--gl-mono);padding:6px 8px}}
.color-lines{{display:grid;gap:4px;margin-top:12px}}.color-lines div{{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:12px;background:white;border:1px solid var(--gl-soft-rule);padding:8px 12px;overflow:hidden}}
.color-lines span:first-child{{font:600 12px/1.3 var(--gl-mono);color:var(--gl-rule)}}.color-lines span+span{{font-size:clamp(28px,5vw,64px);line-height:1.15;white-space:nowrap}}
.color-lines.squint span+span{{filter:blur(.075em)}}
.color-pair{{display:grid;grid-template-columns:1fr 1fr;gap:8px}}.color-pair figure{{margin:0}}.color-pair figcaption{{font:12px/1.4 var(--gl-mono);color:var(--gl-rule);margin-top:4px}}
.color-figure img{{display:block;max-width:100%;height:auto;border:1px solid var(--gl-soft-rule);background:white}}
.color-table{{border-collapse:collapse;font-size:14px}}.color-table td,.color-table th{{border:1px solid var(--gl-soft-rule);padding:4px 10px;text-align:left}}.color-table td+td{{font-family:var(--gl-mono)}}
</style>
</head>
<body><div class="gl-desktop bt-desktop">
<a class="skip" href="#content">Skip to content</a>
<header class="gl-titlebar"><a class="gl-brand" href="/">THEREPROCASE</a><span>FILLAPRINT</span><span class="gl-state">COLOR LEVELING / CANDIDATE</span></header>
<nav class="gl-menu bt-nav" aria-label="Project navigation"><a href="../">← Fillaprint</a><a href="#measure">Measuring color</a><a href="#squint">Squint test</a><a href="#tester">Try it</a><a href="#letters">Letters</a><a href="#limits">Not leveled</a><a href="#files">Files</a></nav>
<main id="content">
<div class="note"><strong>Candidate, not a release.</strong> The installable Fillaprint fonts are still v0.1.3. Everything below is a proposal for review.</div>

<section class="gl-pane" id="measure"><div class="gl-pane-title"><h2>01 / MEASURING COLOR</h2><span>DARKEST SPOT, BLUR 1.5W</span></div>
<div class="pad prose vz-intro"><h3>Leveling the dark joints.</h3>
<p>Type designers call how dark a letter reads its <em>color</em>. In Fillaprint almost all of the uneven color comes from joints: where two strokes meet at an acute angle, finishing fills the narrow wedge between them (a real print would fill it anyway), and the joint reads as a dark spot.</p>
<p>Each letter is measured on its finished outline: blur it by 1.5w, about how a joint reads at label size, and take the darkest spot (1.0 would be solid ink across the whole blur). The joints every 2w-stroke letter is made of set the scale: a plain stroke reads {refs['stroke']:.2f}, an L corner {refs['corner']:.2f}, a T-join {refs['tjoin']:.2f} and a crossing {refs['crossing']:.2f}. The target was <strong>no letter darker than a plain crossing</strong>, because t, f, x and X need crossings and cannot get lighter than one.</p>
<p>Seven letters were darker than that. The leveled candidate changes five of them (K, k, R, M, W) and partly levels N. It keeps every rule the font is built on: 2w strokes, 2w gaps, the 4.85w thickness limit, the spacing checks, and a 10w limit so every letter still fits Fillaprint Mono.</p></div>
<div class="pad color-figure"><img src="peaks.svg" width="730" height="486" alt="Darkest spot of the sixteen darkest letters, current and leveled"><p class="fine">Grey: v0.1.3. Blue: leveled. Letters not listed read lighter than a crossing already.</p></div></section>

<section class="gl-pane" id="squint"><div class="gl-pane-title"><h2>02 / SQUINT TEST</h2><span>{counts[0]} → {counts[1]} DARK SPOTS</span></div>
<div class="pad prose vz-intro"><p>The same lines set in both fonts and blurred by 1.5w. Amber marks every spot darker than a plain crossing.</p></div>
<div class="pad color-figure"><img src="squint.png" alt="Sample lines in v0.1.3 and the leveled candidate, blurred, with spots darker than a crossing in amber"></div></section>

<section class="gl-pane" id="tester"><div class="gl-pane-title"><h2>03 / TRY IT</h2><span>LIVE, BOTH FONTS</span></div>
<div class="pad color-tester"><label for="color-text">Text</label><input id="color-text" type="text" value="MAKE NEW WORK RACKS kink" spellcheck="false">
<label><input id="color-squint" type="checkbox"> Squint (blur by 1.5w)</label><label><input id="color-mono" type="checkbox"> Mono</label>
<div class="color-lines" id="color-lines"><div><span>V0.1.3</span><span data-font="Fillaprint Current">MAKE NEW WORK RACKS kink</span></div><div><span>LEVELED</span><span data-font="Fillaprint Leveled">MAKE NEW WORK RACKS kink</span></div></div></div>
<script>
(() => {{
  const text = document.getElementById("color-text"), lines = document.getElementById("color-lines");
  const spans = lines.querySelectorAll("[data-font]"), mono = document.getElementById("color-mono");
  const paint = () => spans.forEach(s => {{ s.textContent = text.value; s.style.fontFamily = `"${{s.dataset.font}}${{mono.checked ? " Mono" : ""}}"`; }});
  text.addEventListener("input", paint); mono.addEventListener("change", paint);
  document.getElementById("color-squint").addEventListener("change", e => lines.classList.toggle("squint", e.target.checked));
  paint();
}})();
</script></section>

<section class="gl-pane" id="letters"><div class="gl-pane-title"><h2>04 / WHAT CHANGED</h2><span>{len(CARDS)} GLYPHS</span></div>
<div class="pad prose vz-intro"><ul class="vz-legend"><li><span class="swatch ink"></span>Ink as drawn</li><li><span class="swatch fill"></span>Ink added by finishing</li><li><span class="swatch ghost"></span>The other version's outline</li><li>Red ring: the darkest spot. Grid lines every 2w.</li></ul>
{edits_html}</div>
<div class="pad"><div class="vz-grid">
{cards_html}
</div></div></section>

<section class="gl-pane" id="limits"><div class="gl-pane-title"><h2>05 / NOT LEVELED</h2><span>AND WHY</span></div>
<div class="pad prose vz-intro">{not_leveled}</div></section>

<section class="gl-pane" id="files"><div class="gl-pane-title"><h2>06 / FILES AND CHECKS</h2><span>CANDIDATE</span></div>
<div class="pad prose vz-intro"><p>The leveled fonts were rebuilt with the font's own <code>build.py</code> from v0.1.3 plus the edits above, and passed every geometry, outline and spacing check it runs:</p>
<pre><code>{html.escape(chr(10).join(build_tail))}</code></pre>
{tests_html}
<p>These are geometry checks, not print tests. To print a test label, install the candidate beside the released fonts; it is named <strong>Fillaprint Leveled</strong> so it does not replace them: <a href="fonts/FillaprintLeveled-Regular.ttf" download>Fillaprint Leveled</a> · <a href="fonts/FillaprintLeveledMono-Regular.ttf" download>Fillaprint Leveled Mono</a>.</p>
<p class="fine">Measurements, sources and provenance: <a href="color.json">color.json</a>. Generated by <code>scripts/build-fillaprint-color-leveling.py</code>.</p></div></section>
</main>
<footer class="gl-status"><span>THEREPROCASE / FILLAPRINT</span><span>COLOR LEVELING</span></footer>
</div></body></html>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "fonts").mkdir(exist_ok=True)
    refs = reference_peaks()
    with tempfile.TemporaryDirectory() as tmp:
        tree, build_tail = export_leveled(Path(tmp))
        tests_ran, test_failures = run_tests(tree)
        cur, lev = measure(FONT), measure(tree)
        rename_font(tree / "fonts/Fillaprint-Regular.ttf", OUT / "fonts/FillaprintLeveled-Regular.ttf", "Fillaprint Leveled")
        rename_font(tree / "fonts/FillaprintMono-Regular.ttf", OUT / "fonts/FillaprintLeveledMono-Regular.ttf", "Fillaprint Leveled Mono")
        counts = squint_png(FONT / "fonts/Fillaprint-Regular.ttf", tree / "fonts/Fillaprint-Regular.ttf",
                            refs["crossing"], OUT / "squint.png")
    from shapely import wkt
    cards = []
    for fam, c, heading in CARDS:
        key = f"{fam}:{c}"
        slug = f"{fam.lower()}-{'upper' if c.isupper() else 'lower'}-{c.lower()}"
        geo = {t: {k: wkt.loads(v) for k, v in m["cards"][key].items() if k in ("raw", "fin", "sample")}
               for t, m in (("current", cur), ("leveled", lev))}
        for tag, other in (("current", "leveled"), ("leveled", "current")):
            g = geo[tag]
            at = (cur if tag == "current" else lev)["glyphs"][key]["at"]
            (OUT / f"{slug}-{tag}.svg").write_text(glyph_svg(g["fin"], g["raw"], geo[other]["fin"], f"{heading}, {tag}", at),
                                                    encoding="utf-8")
            if "sample" in g:
                (OUT / f"{slug}-{tag}-sample.svg").write_text(line_svg(g["sample"], f"{SAMPLES[c]}, {tag}"), encoding="utf-8")
        cards.append(card_html(fam, c, heading, cur, lev))
    (OUT / "peaks.svg").write_text(chart_svg(cur["glyphs"], lev["glyphs"], refs), encoding="utf-8")

    edits_html = "<ul>" + "".join(f"<li>{html.escape(why)}</li>" for _, _, _, why in EDITS) + "</ul>"

    def g(m, k):
        return m["glyphs"][k]["peak"]

    not_leveled = f"""<p><strong>N ({g(cur, 'P:N'):.2f} → {g(lev, 'P:N'):.2f}).</strong> N's diagonal crosses the full height between two stems, so it meets each stem at about 35°, and three 2w strokes plus two 2w gaps need more than the 10w Mono allows. Every construction tried with the stems upright (round, kinked or shouldered joins, slanted stems) was as dark or darker; a 12w N reaches only 0.82. Widening it to 10w, like M and W, is the step that fits.</p>
<p><strong>V ({g(cur, 'P:V'):.2f}).</strong> The darkness is the point itself, where the arms converge. It changes only with width, and CV2 is the widest V that fits Mono; it was chosen in review, so it is left as it is.</p>
<p><strong>Crossings: Y {g(cur, 'P:Y'):.2f}, x {g(cur, 'P:x'):.2f}, X {g(cur, 'P:X'):.2f}, y {g(cur, 'P:y'):.2f}.</strong> These sit at or just below a plain crossing ({refs['crossing']:.2f}), which is the floor for any letter whose strokes cross.</p>
<p><strong>Overall darkness.</strong> Letters also differ in how much ink they carry: B, 8 and g have three bars where T and L have one or two. That is structural and the same in every typeface; spacing, not shape, evens it out in text, and this candidate does not change spacing rules. Spacing around the edited letters is recomputed by the build as usual.</p>"""

    passed = tests_ran - len(test_failures)
    tests_html = (f"<p>The font's test suite: {passed} of {tests_ran} tests pass on the leveled fonts. "
                  + ("The rest pin the v0.1.3 shapes these edits change on purpose, and would be updated with them:</p><ul>"
                     + "".join(f"<li><code>{html.escape(t.rsplit('.', 1)[1])}</code> {html.escape(why)}</li>"
                               for t, why in test_failures.items()) + "</ul>" if test_failures else "</p>"))
    (OUT / "index.html").write_text(page(cur, lev, refs, counts, build_tail, tests_html, edits_html, "\n".join(cards), not_leveled),
                                    encoding="utf-8")
    rev = subprocess.run(["git", "-C", str(FONT), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    record = {
        "purpose": "Color leveling candidate for review; not part of any released font.",
        "font_repository": "https://github.com/thereprocase/double-bead",
        "font_revision": rev,
        "method": f"Finished glyph outlines rasterized at 8 px/w, Gaussian blur sigma {SIGMA_W}w, darkest value (1 = solid ink).",
        "references": refs,
        "squint_spots_darker_than_crossing": {"current": counts[0], "leveled": counts[1]},
        "edits": [{"file": f, "current": o, "leveled": n, "why": w} for f, o, n, w in EDITS],
        "build_check_summary": build_tail,
        "tests": {"ran": tests_ran, "failed_by_design": test_failures},
        "platform": f"{platform.system()} {platform.machine()} {' '.join(platform.libc_ver())}",
        "python": platform.python_version(),
        "packages": {p: pkg_version(p) for p in ("shapely", "numpy", "scipy", "fonttools", "pillow")},
        "units": "w = one extrusion line width; y points down; cap height at y=-4, x-height at y=0, baseline at y=10",
        "glyphs": {"current": cur["glyphs"], "leveled": lev["glyphs"]},
    }
    (OUT / "color.json").write_text(json.dumps(record, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("references", refs, "| squint spots", counts)
    for k in cur["glyphs"]:
        if cur["glyphs"][k] != lev["glyphs"][k]:
            print(k, cur["glyphs"][k]["peak"], "->", lev["glyphs"][k]["peak"])


if __name__ == "__main__":
    main()
