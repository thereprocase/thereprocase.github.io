import FreeCAD as A,Part,json,math
from pathlib import Path
R=Path(__file__).resolve().parent;V=A.Vector;exec((R/'profile_helpers.py').read_text());out=[]
def read(p):
 s=Part.Shape();s.read(str(p));return s
def compare(a,b,mask,label):
 aa=a.common(mask);bb=b.common(mask);delta=aa.cut(bb).Volume+bb.cut(aa).Volume
 assert delta<.001,(label,delta)
 out.append(dict(test=label,changed_volume_mm3=delta))
for p in (R/'models').glob('bin*.step'):
 old=read(R.parent/'v4/models'/p.name);new=read(p)
 for lo,hi,label in [(-1,6.5,'feet and magnets'),(29.4,35,'stacking receiver')]:compare(old,new,Part.makeBox(220,220,hi-lo,V(-110,-110,lo)),p.stem+' '+label)
a=read(R.parent/'v4/models/carrier-4x4-stacking.step');b=read(R/'carrier-assembly.step')
compare(a,b,Part.makeBox(200,200,4.75,V(-100,-100,0)),'carrier standard feet and underside magnets')
mask=Part.Face(wire(168,168,4,7.5)).extrude(V(0,0,4.75));compare(a,b,mask,'carrier complete 4x4 receiver region')
# Include top magnet cavities in the protected region down to their pocket floors.
for x in [-63,-21,21,63]:
 for y in [-63,-21,21,63]:
  for dx in [-13,13]:
   for dy in [-13,13]:compare(a,b,Part.makeCylinder(3.4,2.5,V(x+dx,y+dy,5.05)),'carrier receiver magnet '+str((x+dx,y+dy)))
compare(a,b,Part.makeBox(200,200,40,V(-100,-100,12.25)),'carrier upper wall and stacking lip')
a=read(R.parent/'v4/models/lid-recessed-deck.step');b=read(R/'models/lid-recessed-deck.step')
compare(a,b,Part.Face(wire(168,168,4,0)).extrude(V(0,0,7.75)),'lid full 4x4 receiver and magnets')
(R/'interface-checks.json').write_text(json.dumps(out,indent=2));print('INTERFACE CHECKS PASS',len(out))
