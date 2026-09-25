"""Build candidate branding from the released Brewster Technical outlines."""
from pathlib import Path
import hashlib
import json
import html
import argparse
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('candidate', nargs='?', default='Linepair', choices=['Linepair', 'Fillaprint'])
candidate = parser.parse_args().candidate
slug = candidate.lower()
initials, study_number = {'Linepair': ('LP', '01'), 'Fillaprint': ('FP', '02')}[candidate]
root = Path(__file__).resolve().parents[1]
source = root / 'public/brewster-technical/fonts/BrewsterTechnical-Regular.ttf'
dest = root / 'public' / slug / 'artwork'
dest.mkdir(parents=True, exist_ok=True)
font = TTFont(source)
glyphs = font.getGlyphSet()
shaper = hb.Font(hb.Face(source.read_bytes()))
shaper.scale = (1000, 1000)

def outlines(text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(shaper, buf)
    paths, boxes, x, y = [], [], 0, 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = font.getGlyphName(info.codepoint)
        pen, bounds = SVGPathPen(glyphs), BoundsPen(glyphs)
        glyphs[name].draw(pen)
        glyphs[name].draw(bounds)
        dx, dy = x + pos.x_offset, y + pos.y_offset
        paths.append(f'<path transform="translate({dx} {dy})" d="{pen.getCommands()}"/>')
        if bounds.bounds:
            a,b,c,d = bounds.bounds
            boxes.append((a+dx,b+dy,c+dx,d+dy))
        x += pos.x_advance
        y += pos.y_advance
    left, bottom = min(b[0] for b in boxes), min(b[1] for b in boxes)
    right, top = max(b[2] for b in boxes), max(b[3] for b in boxes)
    return ''.join(paths), (left,bottom,right,top)

for name, word in [('titlecase',candidate),('lowercase',slug),('uppercase',candidate.upper()),('initials',initials)]:
    paths, (left,bottom,right,top) = outlines(word)
    pad = 60
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left-pad} {-top-pad} {right-left+2*pad} {top-bottom+2*pad}" role="img" aria-labelledby="title">
<title id="title">{html.escape(word)} — candidate wordmark in Brewster Technical</title>
<desc>Unmodified glyph outlines, shaped with the released font's kerning. Candidate artwork; font family remains Brewster Technical.</desc>
<g fill="#0000a8" transform="scale(1 -1)">{paths}</g>
</svg>'''
    (dest / f'{slug}-{name}.svg').write_text(svg, encoding='utf-8')

# A shareable specimen image, typeset from the same TTF; no generated lettering.
im = Image.new('RGB', (1600, 900), '#0000a8')
draw = ImageDraw.Draw(im)
def type_at(text, xy, size, fill='white'):
    draw.text(xy, text, font=ImageFont.truetype(str(source), size), fill=fill, anchor='lt')
type_at(f'CANDIDATE LAUNCH NAME / {study_number}', (70,60), 26)
size = 330
while draw.textlength(candidate, font=ImageFont.truetype(str(source),size)) > 1460:
    size -= 1
type_at(candidate, (70,270), size)
draw.line((70,675,1530,675), fill='white', width=2)
type_at('A typeface for FDM 3D printing.', (70,715), 38)
type_at('Set in Brewster Technical', (70,808), 25)
im.save(dest / f'{slug}-study.png')
(dest / 'provenance.json').write_text(json.dumps({
    'status':'Candidate launch branding; no font rename',
    'candidate':candidate,
    'font':'Brewster Technical', 'version':font['name'].getDebugName(5),
    'source':'/brewster-technical/fonts/BrewsterTechnical-Regular.ttf',
    'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'method':'HarfBuzz shaping and fontTools SVG glyph outlines; Pillow raster specimen',
}, indent=2)+'\n', encoding='utf-8')
print('Built four outlined SVGs and one PNG from Brewster Technical.')
