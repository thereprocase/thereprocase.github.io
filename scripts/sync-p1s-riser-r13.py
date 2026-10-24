"""Publish the checked R13 update 9 review without changing CAD bytes.

Usage: python scripts/sync-p1s-riser-r13.py /path/to/greenfield-13
Legacy download URLs remain available; old viewer entry points lead to this review.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
out = ROOT / 'public/p1s-riser'
review = source / 'review-site'
cad = source / 'candidate-v9-8mm'
report = json.loads((source / 'CURRENT.json').read_text())
assert report['revision'] == 'R13 update 9'
for name, key in [('assembly-check', 'all_clear'), ('diffuser-lift-check', 'all_clear'),
                  ('interface-check', 'all_no_overlap'), ('led-backing-volume-check', 'all_pass')]:
    assert json.loads((cad / f'{name}.json').read_text())[key]

def public_data(value):
    if isinstance(value, dict):
        return {k: public_data(v) for k, v in value.items() if k != 'geometry_directory'}
    if isinstance(value, list):
        return [public_data(v) for v in value]
    if isinstance(value, str) and value.startswith('/home/'):
        return Path(value).name
    return value

views = ['installed', 'context', 'installed-section', 'exploded', 'section', 'lifted', 'joint', 'led-route', 'diffusers', 'clearance', 'print-pose', 'full-printer']
labels = ['Assembled', 'Glass + seat', 'Installed cutaway', 'Exploded', 'Light section', 'Diffuser lifted', 'Puzzle joint', 'LED route', 'Diffusers', 'Clearance bodies', 'Print orientation', 'Full-printer lighting']
if (review / 'support-u9').exists():
    views.insert(-1, 'support')
    labels.insert(-1, 'PC support')
for view in views:
    dest = out / f'{view}-u9'
    shutil.copytree(review / dest.name, dest, dirs_exist_ok=True)
    inputs = dest / 'inputs.json'
    inputs.write_text(json.dumps(public_data(json.loads(inputs.read_text())), indent=2) + '\n')
    shutil.copy2(review / f'{view}-u9.png', out / f'{view}-u9.png')
for name in ['beam-u9.png', 'beam-comparison-u9.json', 'p1s-riser-r13-u9-8mm-review.step', 'light-source-checks-u9.json', 'extra-view-provenance-u9.json']:
    shutil.copy2(review / name, out / name)
(out / 'checks-u9.json').write_text(json.dumps(public_data(report), indent=2) + '\n')

attribution = (out / 'variants/8mm/REFERENCE-ATTRIBUTION.txt').read_text().split('Planned remix')[0]
attribution += '''Current revision: R13 update 9, October 24, 2026.
Changes by thereprocase: four-piece frame, tapered puzzle joints and overlapping
seams, downward-facing LED backing, lift-in diffusers, rounded contact edges,
bed-starting chamfers and a rear cable plug. The original riser was used as a
reference for the printer/glass interface. This package contains the revised
geometry, not the original author's files. CC BY-NC-SA 4.0 applies.
'''
(out / 'REFERENCE-ATTRIBUTION.txt').write_text(attribution)
guide = '''P1S USB light riser — R13 update 9 — 8 mm LED strip

Four frame quarters, four 0.6 mm diffusers and one rear cable plug.
Current material plan: PET-GF15 frame, with a reusable support fixture under
evaluation. PETG remains an alternative; no fit has been qualified in either.
Overall frame height: 26 mm. Glass seat: 23.5 mm. Roof above diffuser pocket: 3.1 mm. Glass pocket: 387 x 355 mm.
LED aim: 45 degrees down on straight sections, twisting upright at corners.

This is the current CAD review. It has not yet been printed or sliced.
Physical puzzle-joint fit, diffuser insertion and printer-lip clearance still
need a fitting trial. The 10/12 mm sections are not complete downloadable kits.

Frame: installed seat down on the print bed. Use a maintained machine,
filament and process profile as the starting point. Plan organic supports from
the build plate only beneath the broad visor underside. Inspect support contacts
and removal access in the sliced preview; do not substitute supports everywhere.
The upper PTFE-contact edges are rounded; bed-starting edges are chamfered.
Diffusers are thin curved parts; their print orientation/toolpath still needs
checking. This package does not contain a vase-mode or ready-to-print job.

Dry-assemble frame quarters in order: front-right, front-left, rear-right,
rear-left. Lower the tapered puzzle keys vertically into their mating parts.
The overlapping seams block direct sightlines through the frame.
The supplied joint-front-left/right pair is a small fit coupon.

Assemble the frame before fitting the LED strip and diffusers. Route the USB
lead through the rear tunnel; the cable plug has a print-oriented file.
Seat the LED tape fully on its backing, bending it upright at the corners.
Lift each diffuser into the upper pocket, move its lower edge over the rounded
slot entrance, then lower it into the seat. There is 1.6 mm lift clearance.
Optional small CA dots at the hidden upper contact can hold it in place.
Check frame seating and glass clearance before installing the lid.

The assembly STEP contains the frame, diffusers and installed cable plug.
For individual printable geometry and the joint coupon, use files in parts/.
All dimensions are millimetres. Attribution and license are in the package.
'''
(out / 'ASSEMBLY-R13-U9.txt').write_text(guide)
package = out / 'p1s-riser-r13-u9-8mm-cad.zip'
with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted((cad / 'parts').iterdir()):
        if p.suffix in ('.step', '.stl') and p.stem != 'rear-cable-plug-installed':
            z.write(p, 'parts/' + p.name)
    z.writestr('ASSEMBLY.txt', guide)
    z.writestr('REFERENCE-ATTRIBUTION.txt', attribution)

def pane(title, body, id):
    return f'<section class="gl-pane" id="{id}"><h2 class="gl-pane-title">{title}</h2><div class="pane-body">{body}</div></section>'

buttons = ''.join(f'<button data-view="{v}" aria-pressed="{str(i == 0).lower()}">{label}</button>'
                  for i, (v, label) in enumerate(zip(views, labels)))
content = pane('Assembly and cutaways', f'''<nav aria-label="Design views">{buttons}</nav>
<iframe id="viewer" src="installed-u9/" title="Interactive riser CAD"></iframe>
<p class="note">Drag to orbit. Right-drag or two fingers to pan. Scroll or pinch to zoom. Double-click to reset.
<a id="full" href="installed-u9/">Full-size viewer</a> · <a id="png" href="installed-u9.png">Image</a></p>''', 'viewer-pane')
content += pane('Download the 8 mm model', '''<div class="downloads">
<a class="button primary" href="p1s-riser-r13-u9-8mm-cad.zip">Individual parts · STEP + STL</a>
<a class="button" href="p1s-riser-r13-u9-8mm-review.step">Assembly STEP</a>
<a class="button" href="ASSEMBLY-R13-U9.txt">Assembly notes</a><a class="button" href="pc-support/">Reusable PC support kit</a></div>
<p>Four frame quarters, four diffusers, a cable plug and a joint-fit coupon. The assembly STEP shows the frame, diffusers and cable plug together.</p>
<p>This revision has passed CAD checks; a physical fitting trial and fresh slice are next. The 10 and 12 mm versions have checked sections, but complete kits are not ready.</p>
<p><a href="SHA256SUMS-R13-U9">Checksums</a> · <a href="REFERENCE-ATTRIBUTION.txt">Attribution and license</a></p>''', 'downloads')
content += '<div class="detail-grid">'
content += pane('A lower, simpler frame', '''<p>Four quarters meet at tapered puzzle joints with overlapping seams. The joints are intended to hold without glue; the small coupon lets you check the fit first.</p>
<ul><li>26 mm overall height; glass seat at 23.5 mm. Roof above the diffuser pocket: 3.1 mm.</li><li>387 × 355 mm glass pocket.</li><li>8 mm LED strip, aimed 45° down on straight runs and upright around the corners.</li><li>Rear cable tunnel with a removable plug.</li></ul>''', 'geometry')
content += pane('Lift-in diffusers', '''<p>Lift the diffuser into the upper pocket, move the bottom over the rounded slot entrance, then lower it into the seat. The entrance has no flat shelf to catch the thin edge. Small CA dots at the hidden upper contact are optional.</p>
<p>The straight diffuser face lies at 30° above horizontal, flatter than the LED backing. It is 0.6 mm thick, with 1.6 mm of insertion lift. Assemble the frame before fitting the strip and diffusers.</p>''', 'assembly')
content += pane('Printing', '''<p>The frame prints seat-down. PET-GF15 is the current material choice; PETG is an alternative. A <a href="pc-support/">three-piece PC support prototype</a> fits beneath the visor, with tapered puzzle joints and low locating feet. Its glue-stick release surface still needs a coupon trial. Bed-starting edges use 30° chamfers from vertical (60° from the bed). The higher edges that the PTFE tube touches stay rounded.</p>
<p>Use your tuned machine, filament and process profiles. Plan organic supports from the build plate only under the broad, flat visor underside. Check the support contacts in the preview before printing.</p>
<p>The new frame and thin diffusers still need a fresh slice and fitting trial. The download contains geometry, not a pre-sliced print job.</p>''', 'printing')
content += pane('Light into the enclosure', '''<p>The shade hides the LEDs from steep overhead views while allowing shallow upward spill around 20–25°. Opening the lower edge gives more of the downward beam a clear path.</p>
<p>The section model passes about 69% of the assumed light output downward, compared with 56% in update 6. This is a geometric comparison, not measured brightness: diffuser scattering, absorption and reflections are not modelled.</p>''', 'light')
content += '</div>'
content += pane('Beam comparison', '''<a href="beam-u9.png"><img src="beam-u9.png" alt="Beam clipping in updates 6 and 9; the current section passes more downward light." style="width:100%;height:auto" loading="lazy"></a>''', 'beam')
content += pane('Geometry checks', '''<p>64 assembly checks and 12 diffuser lift positions pass. The LED backing, glass pocket and cable plug clear their checked boundaries. All 21,125 sampled seam sightlines are blocked; all 1,300 sampled 45° downward rays clear the frame.</p>
<p>Physical joint fit, diffuser insertion and the fit on the printer remain to be checked. The full-printer lighting view uses a simplified printer mock and uncalibrated lighting. <a href="checks-u9.json">Detailed CAD results</a> · <a href="beam-comparison-u9.json">Beam calculation</a></p>''', 'checks')
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>P1S USB light riser · four-piece frame</title><meta name="description" content="Four-piece P1S glass riser with downward-facing USB LEDs, lift-in diffusers, tapered puzzle joints and interactive CAD.">
<link rel="canonical" href="https://thereprocase.github.io/p1s-riser/"><link rel="stylesheet" href="/gridline/gridline.css"><link rel="stylesheet" href="/gridline/polish.css"><link rel="stylesheet" href="/p1s-riser/riser.css"></head>
<body class="gl-polished"><div class="page"><header class="gl-titlebar"><a class="gl-brand" href="/">thereprocase / projects</a><span>P1S USB LIGHT RISER</span></header>
<nav class="project-nav" aria-label="Project navigation"><a href="#viewer-pane">Explore CAD</a><a href="#downloads">Downloads</a><a href="#assembly">Assembly</a><a href="#printing">Printing</a></nav>
<main><header class="intro"><p class="revision">R13 · UPDATE 9 · 8 MM LED · OCTOBER 24, 2026</p><h1>P1S USB light riser</h1>
<p>A four-piece frame with downward-facing LEDs, a rounded shade and lift-in white diffusers. Tapered puzzle joints join the frame; overlapping seams keep light from shining through the joints.</p></header>''' + content + '''
<footer>Printer/glass interface reference: <a href="https://www.printables.com/model/642957-riser-for-bambulab-p1s-with-ventilation-and-light">Andys1957’s P1S riser</a>.
<a href="REFERENCE-ATTRIBUTION.txt">CC BY-NC-SA 4.0 / attribution</a>. Illustrations show the actual CAD.
<a href="https://github.com/thereprocase/thereprocase.github.io/tree/main/public/p1s-riser">Source and files</a>.</footer></main></div>
<script>for(const b of document.querySelectorAll('[data-view]')) b.addEventListener('click',()=>{for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));const v=b.dataset.view+'-u9';document.getElementById('viewer').src=v+'/';document.getElementById('full').href=v+'/';document.getElementById('png').href=v+'.png';});</script></body></html>'''
(out / 'index.html').write_text(html)
# Keep existing downloads intact, but retire the obsolete pages and simulations.
for old in list((out / 'variants').rglob('index.html')) + list((out / 'faux-light').rglob('index.html')):
    target = {'installed': 'context', 'installed-section': 'installed-section', 'assembly': 'context', 'lighting': 'led-route', 'exploded': 'exploded', 'section': 'section', 'retention': 'section', 'clearance': 'clearance', 'vase': 'diffusers', 'faux-light': 'full-printer'}.get(old.parent.name)
    destination = '/p1s-riser/' + (target + '-u9/' if target else '')
    old.write_text(('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=/p1s-riser/"><title>P1S riser — updated design</title><p>This version has been replaced. <a href="/p1s-riser/">Open the current four-piece riser.</a></p></html>''').replace('/p1s-riser/', destination))
files = [package, out / 'p1s-riser-r13-u9-8mm-review.step', out / 'ASSEMBLY-R13-U9.txt', out / 'REFERENCE-ATTRIBUTION.txt']
records = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
(out / 'SHA256SUMS-R13-U9').write_text(''.join(f"{r['sha256']}  {r['file']}\n" for r in records))
(out / 'provenance.json').write_text(json.dumps({'revision': 'R13 update 9', 'downloads': records, 'geometry_modified': False, 'sources_sha256': report['sources_sha256']}, indent=2) + '\n')
print('Published R13 update 9 source assets:', out)
