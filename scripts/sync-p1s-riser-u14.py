"""Publish R13 update 14 (bottom-insert corner block) above the update 10 review.

Usage: python scripts/sync-p1s-riser-u14.py /path/to/greenfield-13 /path/to/P1S-Light-Riser-Quarters

CAD bytes are copied unchanged from the checked candidates; the Desktop delivery supplies the
renders. Update 10 files, viewers and download URLs stay where they are.
Run again after changing the source; the u14 pane is replaced, not duplicated.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source, desktop = Path(sys.argv[1]), Path(sys.argv[2])
out = ROOT / 'public/p1s-riser'
cad, cadg = source / 'candidate-u14-8mm', source / 'candidate-u14g-8mm'
report = json.loads((source / 'CURRENT.json').read_text())
assert report['revision'] == 'R13 update 14'
for c in (cad, cadg):
    checks = json.loads((c / 'checks-u14.json').read_text())
    assert checks['interfaces_all_no_overlap'] and checks['assembly_all_clear'] and checks['assembly_checks'] == 64

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
# Block files: print-oriented candidates under the names used in the Desktop delivery.
blocks = {'block-default-print': 'corner-block-cord4.0-clockwise', 'block-cord3-print': 'corner-block-cord3.0-clockwise',
          'block-cord5-print': 'corner-block-cord5.0-clockwise', 'block-blank-print': 'corner-block-blank-no-cord',
          'keeper-cord3-print': 'cord-keeper-cord3.0', 'keeper-cord4-print': 'cord-keeper-cord4.0', 'keeper-cord5-print': 'cord-keeper-cord5.0'}
for src, name in blocks.items():
    assert sha(cad / 'blocks/parts' / f'{src}.stl') == sha(desktop / 'models-u14-corner/blocks' / f'{name}.stl'), name

guide = '''P1S USB light riser - R13 update 14 - 8 mm LED strip

Changes from update 10
- u11: thicker quarter seams. u11-u14 quarters mate with each other, not with u10.
- u12: 3.4 mm glass rim and a lid-handle pocket. Overall height 26.9 mm.
- u14: the LED strip joint and cord live in a corner block that pushes up into
  the rear-right corner from below. The corner pockets under the glass are filled.

Corner block
- The block is the whole corner body from the printer seat up to Z13.5, 1 mm
  below the visor underside, from X123.4 round the corner to Y83 (frame
  coordinates, origin at the glass centre). The frame keeps the visor, glass
  seat and rim.
- It is held by friction: each end is a shallow crescent, 2.5 mm deep over
  26 mm, with 0.20 mm clearance per side. Lifted off the printer, nothing but
  that friction holds it; on the printer, the printer's lip does.
- It stops against the Z13.5 ceiling on 6 mm lands at each end. Its bottom then
  sits 0.25 mm above the frame bottom, so the frame carries the riser.
- Cord route: open on top, so a strip with its factory cord and plug lays in.
  Joint pocket 14 x 7 x 25 mm; channel cord diameter + 0.8 mm; exit through the
  back skin. Blocks for 3, 4 and 5 mm cord, and a blank with no cord route.
- Strain relief: two M3 heat-set inserts (holes 4.0 mm x 6 mm deep) in the back
  pad and a screw-on keeper for the matching cord size.
- The strip runs clockwise seen from above. Its far end overlaps the fed end
  on the block face anywhere from Y89.3 to Y96.9. Counter-clockwise needs a
  mirrored block, which is not included.

Fitting, riser lifted: lay the joint in the pocket and the cord along the
channel and out of the slot; push the block up until it stops; screw the
keeper on; stick the strip round the frame; fit the diffusers; place the glass.

Printing
- Quarters print seat-down. The rear-right Z13.5 ceiling over the block spans
  140 mm between its ends and needs support from the bed only, through the
  open socket.
- Blocks print as supplied, bottom face on the bed. Keepers print flat face down.
- Print socket-coupon-rear-right-corner with the 4 mm cord block and keeper
  first to check the friction fit on your printer.

Status: CAD checks pass (64 of 64 assembly checks; 21,125 of 21,125 sampled seam
sightlines blocked, front and rear). The corner block has not been printed yet.
Three update 10 quarters have been printed in PETG.

u14g adds a TPU glass gasket: rim 3.9 mm above the seat, 27.4 mm overall, a
4.0 x 1.0 mm groove in the seat, and seven TPU pieces. It uses the same blocks.

All dimensions are millimetres. Attribution and license are in the package.
'''
(out / 'ASSEMBLY-R13-U14.txt').write_text(guide)
attribution = (out / 'REFERENCE-ATTRIBUTION.txt').read_text().split('Current revision:')[0]
attribution += '''Current revision: R13 update 14, October 27, 2026.
Changes by thereprocase: four-piece frame, tapered puzzle joints and overlapping
seams, downward-facing LED backing, lift-in diffusers, a raised glass rim and a
push-up corner block for the LED strip joint and cord. The original riser was
used as a reference for the printer/glass interface. This package contains the
revised geometry, not the original author's files. CC BY-NC-SA 4.0 applies.
'''
(out / 'REFERENCE-ATTRIBUTION.txt').write_text(attribution)

def package(path, candidate, extra):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted((candidate / 'parts').iterdir()):
            if p.suffix in ('.step', '.stl') and not p.stem.startswith('gasket-installed'):
                z.write(p, 'parts/' + p.name)
        for src, name in blocks.items():
            for ext in ('stl', 'step'):
                z.write(cad / 'blocks/parts' / f'{src}.{ext}', f'blocks/{name}.{ext}')
        z.write(candidate / 'assembly.step', 'assembly.step')
        z.writestr('ASSEMBLY.txt', guide + extra)
        z.writestr('REFERENCE-ATTRIBUTION.txt', attribution)

main_zip, gasket_zip = out / 'p1s-riser-r13-u14-8mm-cad.zip', out / 'p1s-riser-r13-u14g-gasket-8mm-cad.zip'
package(main_zip, cad, '')
package(gasket_zip, cadg, '\nThis package is u14g: parts/gasket-print-*.stl are the TPU gasket pieces, glass face down.\n')
renders = [('corner-block-seated', 'Corner block seated in the rear-right quarter, cutaway'),
           ('corner-block-exploded', 'Corner block lowered out of its socket, seen from below'),
           ('corner-block-plan', 'Plan of the rear-right corner: block, cord route and strip overlap window')]
for name, _ in renders:
    shutil.copy2(desktop / 'models-u14-corner' / f'{name}.png', out / f'{name}-u14.png')
files = [main_zip, gasket_zip, out / 'ASSEMBLY-R13-U14.txt', out / 'REFERENCE-ATTRIBUTION.txt']
records = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in files]
(out / 'SHA256SUMS-R13-U14').write_text(''.join(f"{r['sha256']}  {r['file']}\n" for r in records))
prov = json.loads((out / 'provenance.json').read_text())
prov['current'] = {'revision': 'R13 update 14', 'downloads': records, 'geometry_modified': False,
                   'sources_sha256': {p.name: sha(p) for p in [cad / 'assembly.step', cadg / 'assembly.step']}}
(out / 'provenance.json').write_text(json.dumps(prov, indent=2) + '\n')

mb = lambda p: f'{p.stat().st_size / 1e6:.0f} MB'
figures = ''.join(f'<figure><a href="{n}-u14.png"><img src="{n}-u14.png" alt="{t}" loading="lazy"></a><figcaption>{t}</figcaption></figure>' for n, t in renders)
pane = f'''<!-- u14 start --><section class="gl-pane" id="update-14"><h2 class="gl-pane-title">Update 14: corner block for the LED strip joint</h2><div class="pane-body">
<p>The strip's soldered joint and cord now sit in a block that pushes up into the rear-right corner from below. A factory strip with its cord and plug lays into an open-top route; nothing is threaded or soldered. The block is held by friction on two crescent ends at 0.20 mm clearance per side.</p>
<div class="u14-figures">{figures}</div>
<ul><li>Block: the whole corner body from the printer seat up to 13.5 mm, 1 mm below the visor underside. The frame keeps the visor, glass seat and rim.</li>
<li>Joint pocket 14 × 7 × 25 mm; cord channel 0.8 mm wider than the cord. Blocks for 3, 4 and 5 mm cord, plus a blank.</li>
<li>Strain relief: two M3 heat-set inserts and a screw-on cord keeper on the back face.</li>
<li>Since update 10: thicker quarter seams (u11), a 3.4 mm glass rim and lid-handle pocket (u12). Overall height 26.9 mm. These quarters do not mate with update 10 quarters.</li>
<li>The rear-right ceiling over the block spans 140 mm and needs support from the bed.</li></ul>
<div class="downloads"><a class="button primary" href="p1s-riser-r13-u14-8mm-cad.zip">Update 14 parts · STEP + STL · {mb(main_zip)}</a>
<a class="button" href="p1s-riser-r13-u14g-gasket-8mm-cad.zip">With TPU glass gasket · {mb(gasket_zip)}</a>
<a class="button" href="ASSEMBLY-R13-U14.txt">Assembly and print notes</a></div>
<p>CAD checks pass: 64 of 64 assembly checks and all 21,125 sampled seam sightlines blocked. The corner block has not been printed; print the included socket coupon with the 4 mm block first. Three update 10 quarters have been printed in PETG. <a href="SHA256SUMS-R13-U14">Checksums</a></p>
<p>The interactive views below show update 10.</p></div></section><!-- u14 end -->'''
index = out / 'index.html'
html = index.read_text()
if '<!-- u14 start -->' in html:
    a, b = html.index('<!-- u14 start -->'), html.index('<!-- u14 end -->') + len('<!-- u14 end -->')
    html = html[:a] + html[b:]
html = html.replace('<section class="gl-pane" id="viewer-pane">', pane + '<section class="gl-pane" id="viewer-pane">', 1)
html = html.replace('R13 · UPDATE 10 · 8 MM LED · OCTOBER 24, 2026', 'R13 · UPDATE 14 · 8 MM LED · OCTOBER 27, 2026')
html = html.replace('<nav class="project-nav" aria-label="Project navigation"><a href="#viewer-pane">',
                    '<nav class="project-nav" aria-label="Project navigation"><a href="#update-14">Update 14</a><a href="#viewer-pane">')
html = html.replace('<h2 class="gl-pane-title">Assembly and cutaways</h2>', '<h2 class="gl-pane-title">Update 10 assembly and cutaways</h2>')
html = html.replace('<h2 class="gl-pane-title">Download the 8 mm model</h2>', '<h2 class="gl-pane-title">Download update 10</h2>')
assert html.count('id="update-14"') == 1 and 'UPDATE 14' in html
index.write_text(html)
css = out / 'riser.css'
rule = '.u14-figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:12px 0}.u14-figures figure{margin:0}.u14-figures img{width:100%;height:auto;display:block}.u14-figures figcaption{font-size:.85rem;margin-top:4px}'
if '.u14-figures' not in css.read_text():
    css.write_text(css.read_text().rstrip('\n') + '\n' + rule + '\n')
# GitHub Pages serves docs/; it mirrors public/p1s-riser.
shutil.copytree(out, ROOT / 'docs/p1s-riser', dirs_exist_ok=True)
print('Published R13 update 14:', [(r['file'], r['bytes']) for r in records])
