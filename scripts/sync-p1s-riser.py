"""Copy the checked Draft 11 review and apply the public Gridline layout.
Usage: python scripts/sync-p1s-riser.py /path/to/site-dfm11
Requires BeautifulSoup; CAD and download bytes are copied unchanged.
"""
from pathlib import Path
import sys, shutil, hashlib, json
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parents[1]; source=Path(sys.argv[1]); out=R/'public/p1s-riser'
views=['installed','installed-section','assembly','lighting','exploded','section','retention','clearance','vase']
manifest=[]
for w in (8,10,12):
 src=source/'variants'/f'{w}mm'; dest=out/'variants'/f'{w}mm';shutil.copytree(src,dest,dirs_exist_ok=True)
 soup=BeautifulSoup((src/'index.html').read_text(),'html.parser');main=soup.main
 sections={}
 for heading in main.find_all('h2'):
  nodes=[]
  for node in heading.next_siblings:
   if getattr(node,'name',None)=='h2':break
   nodes.append(str(node))
  sections[heading.get_text()]=''.join(nodes)
 def pane(title,body,id):return f'<section class="gl-pane" id="{id}"><h2 class="gl-pane-title">{title}</h2><div class="pane-body">{body}</div></section>'
 nav=str(main.find('nav'));iframe=str(main.find('iframe'));controls=str(main.find('iframe').find_next_sibling('p'))
 options=''.join(f'<option value="{n}"'+(' selected' if n==w else '')+f'>{n} mm strip</option>' for n in (8,10,12))
 lead=f'Eight PETG frame pieces raise the P1S glass lid and carry a continuous USB COB light strip. The light angles down into the enclosure; removable white diffusers sit in bottom slots and are held by quarter-turn keepers.'
 downloads=f'''<div class="downloads"><a class="button primary" href="p1s-riser-{w}mm-led-cad.zip">Download {w} mm kit · STEP + STL</a><a class="button" href="p1s-riser-{w}mm-led-assembly.step">Assembly STEP</a><a class="button" href="PRINT-AND-ASSEMBLY.txt">Assembly guide</a></div><p>Includes the eight frame pieces, keepers, cable plug, matching diffusers, vase blanks, fit coupons and geometry-only plate layouts. Choose your own filament and printer settings before slicing.</p><p><a href="SHA256SUMS">Download checksums</a> · <a href="REFERENCE-ATTRIBUTION.txt">Attribution and license</a></p>'''
 chooser=f'''<div class="chooser"><label for="strip-width">LED strip width</label><select id="strip-width" onchange="location.href='/p1s-riser/variants/'+this.value+'mm/'">{options}</select><span class="revision">Draft 11 · PETG · 0.4 mm nozzle</span></div><p>Same footprint in all three sizes. The 10 mm kit is 2 mm taller; the 12 mm kit is 4 mm taller. Use matching frames and diffusers; the keepers and cable plug are shared.</p><div class="table-wrap"><table><thead><tr><th>Strip</th><th>Glass-seat height</th><th>Diffuser height</th></tr></thead><tbody><tr><td>8 mm</td><td>30 mm</td><td>10.3 mm</td></tr><tr><td>10 mm</td><td>32 mm</td><td>12.3 mm</td></tr><tr><td>12 mm</td><td>34 mm</td><td>14.3 mm</td></tr></tbody></table></div>'''
 content=pane('Choose a strip width',chooser,'sizes')+pane('Assembly and cutaways',nav+iframe+controls,'viewer-pane')+pane(f'Download the {w} mm kit',downloads,'downloads')
 content+='<div class="detail-grid">'
 for title,id in [('Where the glass sits','glass'),('Geometry','geometry'),('Assembly and access','assembly'),('Vase diffuser option','diffusers'),('Overlapping roof seat and cam keepers','keepers'),('Printing and assembly','printing'),('Clearance checkers','clearance-checks'),('What still needs a fitting trial','fit')]:
  body=sections[title]
  # The original glass prose is followed by a separate grid; do not duplicate it.
  if title=='Where the glass sits': body=body.split('<div class="grid">')[0]
  body=body.replace('keep it upright instead.','hold it against the roof seat.').replace('The rear tunnel and plug sit 0.5 mm lower to retain the 18 × 10 mm clear passage beneath the taller seat.','The rear tunnel has an 18 × 10 mm clear passage.')
  content+=pane(title,body,id)
 content+='</div>'+pane('CAD and toolpath checks',sections['CAD checks']+'<p><a href="checks.json">CAD results</a> · <a href="dfm-report.json">Slice reports</a></p><p>Lower support ramps are 30° from vertical (60° above the bed). The upper lips and receiver overhangs still need supports. Start with the small fit coupons to check your PETG and diffuser wall.</p>','checks-pane')
 scripts=''.join(str(s) for s in soup.find_all('script'))
 footer='<footer>Reference: <a href="https://www.printables.com/model/642957-riser-for-bambulab-p1s-with-ventilation-and-light">Andys1957’s P1S riser</a> · <a href="REFERENCE-ATTRIBUTION.txt">CC BY-NC-SA 4.0 / attribution</a>. Illustrations use the actual CAD. <a href="https://github.com/thereprocase/thereprocase.github.io/tree/main/public/p1s-riser">Site source and files</a>.</footer>'
 html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>P1S USB light riser · {w} mm strip</title><meta name="description" content="Printable P1S glass riser for 8, 10 or 12 mm USB COB strips. Interactive CAD, removable diffusers, STEP/STL downloads and assembly guide."><link rel="canonical" href="https://thereprocase.github.io/p1s-riser/variants/{w}mm/"><link rel="stylesheet" href="/gridline/gridline.css"><link rel="stylesheet" href="/gridline/polish.css"><link rel="stylesheet" href="/p1s-riser/riser.css"></head><body class="gl-polished"><div class="page"><header class="gl-titlebar"><a class="gl-brand" href="/">thereprocase / projects</a><span>P1S USB LIGHT RISER</span></header><nav class="project-nav" aria-label="Project navigation"><a href="#viewer-pane">Explore CAD</a><a href="#downloads">Downloads</a><a href="#assembly">Assembly</a><a href="#printing">Printing</a><a href="#fit">Fit coupons</a></nav><main><header class="intro"><p class="revision">DRAFT 11 · {w} MM LED · OCTOBER 21, 2026</p><h1>P1S USB light riser</h1><p>{lead}</p></header>{content}{footer}</main></div>{scripts}</body></html>'''
 (dest/'index.html').write_text(html)
 # Preserve the renderer itself; make its text fit small embedded viewports.
 for view in views:
  scene=dest/view/'scene.json';data=json.loads(scene.read_text());data['caption']=data.get('caption','').replace('glass at Z30',f'glass at Z{30+w-8}');scene.write_text(json.dumps(data,indent=2))
  p=dest/view/'index.html';s=p.read_text().replace('</style>','@media(max-width:700px){header{top:16px;left:16px;right:16px}h1{font-size:22px;letter-spacing:0}p{font-size:13px}footer{bottom:14px;left:16px;right:16px;font-size:12px}} </style>');p.write_text(s)
 for suffix in ('cad.zip','assembly.step'):
  p=dest/f'p1s-riser-{w}mm-led-{suffix}';assert p.read_bytes()==(src/p.name).read_bytes();manifest.append(dict(file=str(p.relative_to(out)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size))
 if w==8:
  html=html.replace('<head>','<head><base href="/p1s-riser/variants/8mm/">').replace('https://thereprocase.github.io/p1s-riser/variants/8mm/','https://thereprocase.github.io/p1s-riser/')
  (out/'index.html').write_text(html)
(out/'provenance.json').write_text(json.dumps(dict(revision=11,downloads=manifest,geometry_modified=False),indent=2))
