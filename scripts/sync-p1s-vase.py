"""Publish the checked eight-piece vase diffuser prototype and its actual CAD views."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
review = source / 'review'
dest = root / 'public/p1s-riser/vase'
dest.mkdir(parents=True, exist_ok=True)
checks = json.loads((review / 'checks.json').read_text())
assert checks['fit']['all_clear']
assert all(r['pass'] for r in checks['toolpath'].values())
views = ['tilt', 'straights', 'corners', 'installed', 'toolpath']
for name in views:
    shutil.copytree(review / f'{name}-view', dest / f'{name}-view', dirs_exist_ok=True)
    inputs = dest / f'{name}-view' / 'inputs.json'
    data = json.loads(inputs.read_text())
    for row in data:
        row['mesh'] = Path(row['mesh']).name
    inputs.write_text(json.dumps(data, indent=2) + '\n')
    shutil.copy2(review / f'{name}.png', dest / f'{name}.png')
zipname = next(p.name for p in review.glob('*prototype5.zip'))
for name in ['checks.json', 'README.txt', 'SHA256SUMS', zipname]:
    shutil.copy2(review / name, dest / name)
shutil.copy2(root / 'public/p1s-riser/REFERENCE-ATTRIBUTION.txt', dest / 'REFERENCE-ATTRIBUTION.txt')
manifest = {'revision': 'Vase diffuser prototype 5', 'frame_revision': 'R13 update 10', 'file': zipname,
    'sha256': hashlib.sha256((dest / zipname).read_bytes()).hexdigest(), 'geometry_modified_for_publication': False}
(dest / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
html = (review / 'index.html').read_text()
# Public pages use the shared site stylesheets and the riser landing page.
html = html.replace('href="gridline/gridline.css"', 'href="/gridline/gridline.css"').replace('href="gridline/polish.css"', 'href="/gridline/polish.css"')
html = html.replace('href="riser.css"', 'href="/p1s-riser/riser.css"').replace('<a class="gl-brand" href="../">P1S riser</a>', '<a class="gl-brand" href="/p1s-riser/">P1S USB light riser</a>')
html = html.replace('<a href="SHA256SUMS">Checksum</a>', '<a href="SHA256SUMS">Checksum</a> · <a href="provenance.json">Download hash</a>')
assert 'gridline/' not in re.sub(r'href="/gridline/', '', html)
(dest / 'index.html').write_text(html)
for p in dest.rglob('*'):
    if p.is_file() and p.suffix in {'.html', '.json', '.txt'}:
        assert '/home/' not in p.read_text(), p
print('Published vase diffuser prototype with five current-CAD views:', dest)
