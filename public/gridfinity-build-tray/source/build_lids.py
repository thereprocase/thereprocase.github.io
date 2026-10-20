import FreeCAD as A,Part,MeshPart,json,math
from pathlib import Path
R=Path(__file__).resolve().parent;O=R/'models';V=A.Vector;exec((R/'profile_helpers.py').read_text())
def rr(w,h,r,z,t):return Part.Face(wire(w,h,r,z)).extrude(V(0,0,t))
def read(n):
 s=Part.Shape();s.read(str(O/(n+'.step')));return s
def move(s,x=0,y=0,z=0):
 a=s.copy();a.translate(V(x,y,z));return a
carrier=Part.Shape();carrier.read(str(R/'carrier-assembly.step'));validation=json.loads((R/'validation.json').read_text());bins=[move(read(n),x,y,7.5) for n,x,y in validation['layout']]
skirt=rr(180.6,180.6,8.3,32.5,14.25).cut(rr(176.6,176.6,6.3,32.49,14.27))
groove=rr(172.6,172.6,4.3,46.74,2.26).cut(rr(167.9,167.9,1.95,46.73,2.28))
slim=rr(180.6,180.6,8.3,46.75,4.25).fuse(skirt).cut(groove)
# A 1.6 mm roof with 1.8 mm ribs replaces the solid central plate.
relief=rr(164.8,164.8,3.2,46.74,2.66)
ribs=[]
for c in [-42,0,42]:
 ribs +=[Part.makeBox(1.8,166,3,V(c-.9,-83,46.7)),Part.makeBox(166,1.8,3,V(-83,c-.9,46.7))]
slim=slim.cut(relief.cut(Part.makeCompound(ribs))).removeSplitter()
# The separate frame receives the deck on a continuous 45-degree tapered seat.
frame=rr(180.6,180.6,8.3,46.75,4.65).fuse(skirt).cut(groove)
opening=loft([(46.7,168.6,168.6,4.3),(49.5,168.6,168.6,4.3),(51.2,172,172,6),(51.4,172.4,172.4,6.2),(53,175.6,175.6,7.8)])
frame=frame.cut(opening).removeSplitter()
# Recessed receiver: 46.65 seating level, versus V3's 54 mm.
# A continuous 45-degree flare mates to the frame; neither part has an abrupt flange overhang.
deck=rr(168,168,4,43.65,5.55).fuse(loft([(49.2,168,168,4),(51.2,172,172,6)])).fuse(rr(172,172,6,51.2,.2))
cuts=[];magnets=[]
for x in [-63,-21,21,63]:
 for y in [-63,-21,21,63]:
  cuts.append(loft([(46.65,36.1,36.1,1.05),(47.45,37.7,37.7,1.85),(49.25,37.7,37.7,1.85),(51.4,42,42,4),(52.2,42,42,4)],x,y))
  for dx in [-13,13]:
   for dy in [-13,13]:
    h=Part.makeCylinder(3.1,2.41,V(x+dx,y+dy,44.25)).fuse(Part.makeCone(3.1,3.3,.2,V(x+dx,y+dy,46.45)));magnets.append(h)
deck=deck.cut(Part.makeCompound(cuts+magnets)).removeSplitter()
checks=[]
def clear(a,b,label):
 v=a.common(b).Volume;assert v<.001,(label,v);checks.append(dict(test=label,interference_mm3=v))
def support(a,b,z,label,minimum=100):
 aa=[f for f in a.Faces if abs(f.BoundBox.ZMin-z)<1e-6 and abs(f.BoundBox.ZMax-z)<1e-6];bb=[f for f in b.Faces if abs(f.BoundBox.ZMin-z)<1e-6 and abs(f.BoundBox.ZMax-z)<1e-6]
 area=sum(x.common(y).Area for x in aa for y in bb);assert area>minimum,(label,area);checks.append(dict(test=label,contact_area_mm2=area))
doc=A.openDocument(str(R/'portable-grid-workspace.FCStd'))
for obj in list(doc.Objects):
 if obj.Name.startswith('lid_'):doc.removeObject(obj.Name)
for name,s,top in [('lid-slim',slim,51),('lid-receiver-frame',frame,51.4),('lid-recessed-deck',deck,None)]:
 assert s.isValid() and len(s.Solids)==1,name
 clear(carrier,s,name+' carrier');
 if top:support(carrier,s,46.75,name+' bearing')
 for i,b in enumerate(bins):clear(s,b,name+' lower bin '+str(i))
 p=s.copy()
 if top:p.rotate(V(0,0,0),V(1,0,0),180);p.translate(V(0,0,top))
 else:p.translate(V(0,0,-43.65))
 p.exportStep(str(O/(name+'.step')));m=MeshPart.meshFromShape(Shape=p,LinearDeflection=.015,AngularDeflection=.07,Relative=False);assert m.isSolid();m.write(str(O/(name+'.stl')))
 q=Part.Shape();q.read(str(O/(name+'.step')));assert q.isValid() and len(q.Solids)==1
 obj=doc.addObject('PartDesign::Feature',name.replace('-','_'));obj.Label=name;obj.Shape=p
 m=MeshPart.meshFromShape(Shape=s,LinearDeflection=.015,AngularDeflection=.07,Relative=False);vs,fs=m.Topology;(R/(name+'.mesh.json')).write_text(json.dumps(dict(vertices=[list(v) for v in vs],faces=fs)))
 validation['models']=[d for d in validation['models'] if d['name']!=name];validation['models'].append(dict(name=name,dimensions_mm=[p.BoundBox.XLength,p.BoundBox.YLength,p.BoundBox.ZLength],volume_mm3=p.Volume,valid_single_solid=True,closed_mesh=True,step_readback_valid=True,receiver_magnet_pockets=64 if top is None else 0))
 print('SAVED',name,flush=True)
clear(frame,deck,'deck frame seating')
taper_a=[f for f in frame.Faces if f.BoundBox.ZMin>=49.49 and f.BoundBox.ZMax<=51.41]
taper_b=[f for f in deck.Faces if f.BoundBox.ZMin>=49.19 and f.BoundBox.ZMax<=51.41]
bearing=sum(f.common(g).Area for f in taper_a for g in taper_b);assert bearing>100,bearing
checks.append(dict(test='45 degree deck frame bearing',contact_area_mm2=bearing))
receiver=Part.makeCompound([frame,deck])
for n in ['bin-1x1-open','bin-1x2-open','bin-2x2-open','bin-2x4-open','bin-2x4-two','bin-2x4-four']:
 b=read(n);bb=b.BoundBox;nx=round((bb.XLength+.5)/42);ny=round((bb.YLength+.5)/42)
 clear(receiver,move(b,-63+(nx-1)*21,-63+(ny-1)*21,46.65),'receiver '+n)
upper=move(carrier,z=46.65);clear(receiver,upper,'receiver upper carrier');support(receiver,upper,46.65,'receiver upper feet');support(frame,upper,51.4,'receiver upper carrier rim')
checks.append(dict(test='clearance and DFM dimensions',bare_stack_headroom_mm=1.5,recessed_lid_headroom_mm=3.15,bin_floor_mm=1.75,carrier_midwall_mm=2,slim_roof_mm=1.6,deck_center_floor_mm=3.0,deck_magnet_floor_mm=.6,flange_print_overhang_mm=0.0,magnet_pocket_roof_span_mm=6.2))
Part.makeCompound([carrier]+bins+[slim]).exportStep(str(R/'slim-lid-assembly.step'))
Part.makeCompound([carrier]+bins+[frame,deck]+[move(b,z=39.15) for b in bins]).exportStep(str(R/'receiver-lid-assembly.step'))
receiver.exportStep(str(R/'receiver-lid-assembly-only.step'))
validation['lid_checks']=checks;validation['lids']=dict(slim_added_height_mm=2.25,receiver_added_height_mm=2.65,receiver_seat_z_mm=46.65,carrier_skirt_clearance_per_side_mm=.3,notch_overlap_mm=.5,deck_to_bin_clearance_mm=3.15,physical_validation='pending')
(R/'validation.json').write_text(json.dumps(validation,indent=2));doc.recompute();doc.saveAs(str(R/'portable-grid-workspace.FCStd'));print('LID CHECKS PASS',flush=True)
# Real section solids for the preview, cut through an off-centre row to expose the floors and clearance.
mask=Part.makeBox(220,116,160,V(-110,-16,-1));section=[]
for name,shape in [('section-carrier',carrier),('section-frame',frame),('section-deck',deck)]+[('section-bin-'+str(i),b) for i,b in enumerate(bins)]+[('section-upper-bin',move(read('bin-2x2-open'),-42,-42,46.65))]:
 cut=shape.common(mask)
 if cut.Volume<.001:continue
 m=MeshPart.meshFromShape(Shape=cut,LinearDeflection=.015,AngularDeflection=.07,Relative=False);vs,fs=m.Topology
 (R/(name+'.mesh.json')).write_text(json.dumps(dict(vertices=[list(v) for v in vs],faces=fs)));section.append(name)
(R/'section-parts.json').write_text(json.dumps(section));print('SECTION MESHES PASS',flush=True)

# Optional assembly gauges: four flat prints set the wall's installed height.
acc=R/'accessories';acc.mkdir(exist_ok=True)
gauge=rr(6,18,1,0,4.75);assert gauge.isValid() and len(gauge.Solids)==1
gauge.exportStep(str(acc/'carrier-alignment-gauge.step'))
gm=MeshPart.meshFromShape(Shape=gauge,LinearDeflection=.015,AngularDeflection=.07,Relative=False);assert gm.isSolid();gm.write(str(acc/'carrier-alignment-gauge.stl'))
