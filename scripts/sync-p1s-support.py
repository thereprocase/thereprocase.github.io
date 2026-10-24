"""Publish the checked reusable PC support prototype and its actual CAD views."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
dest = root / 'public/p1s-riser/pc-support'
dest.mkdir(parents=True, exist_ok=True)
report = json.loads((source / 'checks.json').read_text())
assert report['all_clear']
coverage = json.loads((source / 'coverage-checks.json').read_text())
assert coverage['all_pass']
assert all(p['valid'] and p['solids'] == 1 for p in report['parts'].values())
views = [('kit', 'Three pieces'), ('coverage', 'Visor coverage'), ('pause', 'Placement'), ('placed', 'Under the visor'), ('section', 'Contact + feet'), ('joint', 'Puzzle joint')]
for name, _ in views:
    shutil.copytree(source / f'{name}-view', dest / name, dirs_exist_ok=True)
    inputs = dest / name / 'inputs.json'
    data = json.loads(inputs.read_text())
    for row in data:
        row['mesh'] = Path(row['mesh']).name
    inputs.write_text(json.dumps(data, indent=2) + '\n')
    shutil.copy2(source / f'{name}.png', dest / f'{name}.png')
shutil.copy2(source / 'checks.json', dest / 'checks.json')
shutil.copy2(source / 'coverage-checks.json', dest / 'coverage-checks.json')
instructions = '''Reusable PC visor support — prototype 2 for R13 update 9

Print the corner, long rail and short rail in PC, feet down. The rails use
vertical tapered puzzle keys. Swap the two rails between corner legs for the
mirrored quarters: the long rail follows the printer's left/right dimension.
The same three parts are intended to serve all four quarter prints.

Full visor footprint plus 2 mm design padding. Measured perimeter margin
is at least 1.5 mm with ±0.2 mm placement play on all four quarters. Intentional sliding puzzle joints
leave narrow seams (checked within 0.11 mm of support); these are not
continuous contact surfaces.

Bare tool top: 14.44 mm. CAD visor underside: 14.50 mm. Bare gap: 0.06 mm.
Registration feet: approximately 0.20 mm nominal side clearance.
Puzzle keys: 0.10 mm radial clearance, tapering toward the bottom.

Use heavy glue stick on the support's top contact faces as the release coating.
Let it dry and check the coated height. A heavy coat may exceed the nominal
0.06 mm bare gap; do not assume the coated tool still has that clearance.
Keep glue off the locating feet and puzzle joints.

Use the maintained PC profile for the tool and PET-GF15 profile for the frame.
Before slicing the full frame, print the small matching coupon pair, then use
the PC coupon repeatedly to check release and surface wear. Neither the tool
nor the coupon has been physically tested yet.

Placement sequence (CAD-checked, not yet a sliced printer routine):
1. Print the frame up to the planned insertion pause, before the visor begins.
2. Assemble the support. Lower it into the open centre about 12 mm inward on
   each axis from its final position (roughly 17 mm diagonally).
3. With its feet resting on the bed, slide it outward to register against the
   printed lower rim. There is a little clearance; don't wedge or force it.
4. Resume only after checking the actual toolhead and travel clearance.
5. After printing and cooling, slide the tool inward before lifting it out.

Do not lower it vertically in its final position: the low feet hit the LED
backing during that approach. The inward-then-slide route avoids this.

Final height and pause must be reconciled with the first supported layer's
ACTUAL sliced underside. A normal 0.20 mm layer is larger than the 0.06 mm gap.
The CAD height is a trial dimension, not a ready-to-use pause Z. No mid-print
homing, probing or local layer-height correction is included.

The archive contains three full-size PC parts and two optional test coupons.
PET-GF15 visor coupon = part being printed. PC support coupon = reusable tool.
All parts are millimetres, with their print datum at Z0. No G-code is included.
'''
(dest / 'ASSEMBLY.txt').write_text(instructions)
shutil.copy2(root / 'public/p1s-riser/REFERENCE-ATTRIBUTION.txt', dest / 'REFERENCE-ATTRIBUTION.txt')
archive = dest / 'p1s-r13-u9-pc-support-u2-step-stl.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['corner', 'long-rail', 'short-rail', 'pc-support-coupon', 'pet-gf15-visor-coupon']:
        folder = 'coupons' if name.endswith('coupon') else 'pc-parts'
        for ext in ['step', 'stl']:
            z.write(source / 'parts' / f'{name}.{ext}', f'{folder}/{name}.{ext}')
    z.writestr('ASSEMBLY.txt', instructions)
    z.write(source / 'coverage-checks.json', 'coverage-checks.json')
    z.write(dest / 'REFERENCE-ATTRIBUTION.txt', 'REFERENCE-ATTRIBUTION.txt')
manifest = {'revision': 'PC support prototype 2', 'frame_revision': 'R13 update 9',
    'file': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'geometry_modified_for_publication': False, 'frame_source_sha256': report['source_sha256']}
(dest / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
buttons = ''.join(f'<button data-view="{v}" aria-pressed="{str(i == 0).lower()}">{label}</button>' for i, (v, label) in enumerate(views))
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reusable PC support for the P1S riser</title><link rel="stylesheet" href="/gridline/gridline.css"><link rel="stylesheet" href="/gridline/polish.css"><link rel="stylesheet" href="/p1s-riser/riser.css"></head>
<body class="gl-polished"><div class="page"><header class="gl-titlebar"><a class="gl-brand" href="/p1s-riser/">P1S USB light riser</a><span>PC SUPPORT · PROTOTYPE 2</span></header><main>
<header class="intro"><h1>Reusable visor support</h1><p>A PC corner and two straight rails join with tapered puzzle keys. Swap the rails between the legs to use the same set for all four frame quarters. Low feet locate the tool against the frame already on the bed. The wider rails and filled corner extend at least 1.5 mm past the complete visor footprint.</p></header>
<section class="gl-pane"><h2 class="gl-pane-title">Support and contact surfaces</h2><div class="pane-body"><nav aria-label="Design views">''' + buttons + '''</nav><iframe id="viewer" src="kit/" title="PC support CAD"></iframe>
<p class="note">Drag to orbit. Right-drag or two fingers to pan. Scroll or pinch to zoom. <a id="full" href="kit/">Full-size viewer</a> · <a id="png" href="kit.png">Image</a></p></div></section>
<section class="gl-pane"><h2 class="gl-pane-title">Download the prototype</h2><div class="pane-body"><div class="downloads"><a class="button primary" href="p1s-r13-u9-pc-support-u2-step-stl.zip">Three PC parts + test coupons · STEP/STL</a><a class="button" href="ASSEMBLY.txt">Placement notes</a></div><p>The kit includes a small PET-GF15 visor coupon and matching PC support coupon for testing the glue-stick release surface before a full frame print.</p><p><a href="coverage-checks.json">Visor coverage checks</a> · <a href="checks.json">Clearance checks</a> · <a href="provenance.json">Download hash</a> · <a href="REFERENCE-ATTRIBUTION.txt">Attribution</a></p></div></section>
<div class="detail-grid"><section class="gl-pane"><h2 class="gl-pane-title">Locate it, then slide it home</h2><div class="pane-body"><p>At the insertion pause, lower the assembled tool into the opening about 12 mm inward along each axis. Rest the feet on the bed, then slide outward until they register against the printed rim. Removal reverses that movement.</p><p>Lowering straight into the final position would catch the feet on the LED backing. The checked route enters farther inward first.</p></div></section>
<section class="gl-pane"><h2 class="gl-pane-title">Height and release coating</h2><div class="pane-body"><p>The support follows the full visor footprint with a 2 mm design border. The checked minimum stays above 1.5 mm with ±0.2 mm placement play across all four quarters. The small sliding clearances at the puzzle joints remain.</p><p>The bare tool is 14.44 mm tall, 0.06 mm below the CAD visor. The feet have about 0.20 mm side clearance; puzzle keys have 0.10 mm radial clearance.</p><p>Use heavy glue stick on the top contact faces, let it dry, and check the coated height. The film can be thicker than the bare gap.</p><p>The final height and insertion pause need checking against the sliced layers and printhead travel. The geometry checks pass; coated release and reuse still need the coupon trial. No probing or re-zeroing is part of this method.</p></div></section></div>
</main></div><script>for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));const v=b.dataset.view;document.getElementById('viewer').src=v+'/';document.getElementById('full').href=v+'/';document.getElementById('png').href=v+'.png';};</script></body></html>'''
(dest / 'index.html').write_text(html)
# The main review gets one support tab; the dedicated page holds all six views.
shutil.copytree(dest / 'section', dest.parent / 'support-u9', dirs_exist_ok=True)
shutil.copy2(dest / 'section.png', dest.parent / 'support-u9.png')
# Same review is available privately beside the working model.
private = source.parent / 'review-site'
shutil.copytree(dest, private / 'pc-support', dirs_exist_ok=True)
p = private / 'pc-support/index.html'
s = p.read_text().replace('href="/gridline/', 'href="https://thereprocase.github.io/gridline/').replace('href="/p1s-riser/riser.css"', 'href="https://thereprocase.github.io/p1s-riser/riser.css"').replace('href="/p1s-riser/"', 'href="../"')
p.write_text(s)
shutil.copytree(dest / 'section', private / 'support-u9', dirs_exist_ok=True)
shutil.copy2(dest / 'section.png', private / 'support-u9.png')
p = private / 'index.html';s = p.read_text()
if 'data-view="support"' not in s:
    s = s.replace('</nav>', '<button data-view="support" aria-pressed="false">PC support</button></nav>', 1)
if 'href="pc-support/"' not in s:
    s = s.replace('<div class="downloads">', '<div class="downloads"><a class="button" href="pc-support/">PC support kit</a>', 1)
p.write_text(s)
print('Published PC support prototype with six current-CAD views:', dest)
