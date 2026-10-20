import FreeCAD as A,Part,MeshPart,json,math
from pathlib import Path
R=Path(__file__).resolve().parent;O=R/'models';O.mkdir(exist_ok=True)
V=A.Vector;exec((R/'profile_helpers.py').read_text())
doc=A.newDocument('PortableGridWorkspace');shapes={};records=[]
BIN_RISE=1.4
def centers(n):return [(i-(n-1)/2)*42 for i in range(n)]
def rr(w,h,r,z,t):return Part.Face(wire(w,h,r,z)).extrude(V(0,0,t))
def feet(nx,ny):return [loft([(0,35.6,35.6,.8),(.8,37.2,37.2,1.6),(2.6,37.2,37.2,1.6),(4.75,41.5,41.5,3.75)],x,y) for x in centers(nx) for y in centers(ny)]
def holes(nx,ny,z=0,top=False):
 out=[]
 for x in centers(nx):
  for y in centers(ny):
   for dx in [-13,13]:
    for dy in [-13,13]:
     out.append(Part.makeCylinder(3.1,2.41,V(x+dx,y+dy,z-2.4 if top else z-.01)))
     out.append(Part.makeCone(3.1 if top else 3.3,3.3 if top else 3.1,.2,V(x+dx,y+dy,z-.2 if top else z)))
 return Part.makeCompound(out)
def save(name,s,nx,ny,kind):
 assert s.isValid() and len(s.Solids)==1,name
 s.exportStep(str(O/(name+'.step')))
 m=MeshPart.meshFromShape(Shape=s,LinearDeflection=.045,AngularDeflection=.14,Relative=False);assert m.isSolid(),name;m.write(str(O/(name+'.stl')))
 check=Part.Shape();check.read(str(O/(name+'.step')));assert check.isValid() and len(check.Solids)==1
 obj=doc.addObject('PartDesign::Feature',name.replace('-','_'));obj.Shape=s;obj.Label=name
 shapes[name]=s;b=s.BoundBox
 records.append(dict(name=name,kind=kind,cells=[nx,ny],dimensions_mm=[b.XLength,b.YLength,b.ZLength],volume_mm3=s.Volume,valid_single_solid=True,closed_mesh=True,step_readback_valid=True,underside_magnet_pockets=0 if name=="carrier-wall" else nx*ny*4))
 print('SAVED',name,flush=True)
# Each bin has a perimeter landing at Z29.4 and a receiver for the lower 3.6 mm of the next bin's feet.
specs=[('bin-1x1-open',1,1,1),('bin-1x2-open',1,2,1),('bin-2x2-open',2,2,1),('bin-2x4-open',2,4,1),('bin-2x4-two',2,4,2),('bin-2x4-four',2,4,4)]
for name,nx,ny,div in specs:
 w,h=42*nx-.5,42*ny-.5
 s=rr(w,h,3.75,4.75,28.25).multiFuse(feet(nx,ny))
 # Scoop floor, 1.8 mm walls, and a longer inward shoulder so rounded corners stay above 45 degrees.
 cavity=loft([(6.5,w-7.6,h-7.6,1),(8.5,w-3.6,h-3.6,1.95),(26.0,w-3.6,h-3.6,1.95),(29.4,w-8,h-8,1)])
 receiver=loft([(29.4,w-5.4,h-5.4,1.05),(30.2,w-3.8,h-3.8,1.85),(32,w-3.8,h-3.8,1.85),(33,w-1.8,h-1.8,2.85),(34.4,w-1.8,h-1.8,2.85)])
 s=s.cut(cavity.fuse(receiver))
 if div>1:
  walls=[Part.makeBox(w-3.6,1.8,20.7,V(-(w-3.6)/2,-h/2+h*j/div-.9,6.5)) for j in range(1,div)]
  s=s.multiFuse(walls)
 s=s.cut(holes(nx,ny)).removeSplitter();save(name,s,nx,ny,'stackable magnetic bin')
# 4x4 deck, with 4.25 mm overhang beyond bin edges to carry a load-bearing rim.
s=rr(176,176,6,4.75,42).multiFuse(feet(4,4))
s=s.cut(loft([(12.25,168.5,168.5,2.25),(14,172,172,4),(41.25,172,172,4),(43,168.5,168.5,2.25),(55,168.5,168.5,2.25)]))
for x in centers(4):
 for y in centers(4):
  socket=loft([(7.5,36.1,36.1,1.05),(8.3,37.7,37.7,1.85),(10.1,37.7,37.7,1.85),(12.25,42,42,4),(13,42,42,4)],x,y)
  s=s.cut(socket)
# Lip sits in a matching underside annular groove, with .3 mm lateral clearance.
lip=rr(172,172,4,46.75,2).cut(rr(168.5,168.5,2.25,46.74,2.02));s=s.fuse(lip)
groove=rr(172.6,172.6,4.3,4.74,2.26).cut(rr(167.9,167.9,1.95,4.73,2.28));s=s.cut(groove)
# Two rounded bottom finger-access cutouts; remaining rim carries the stacked load.
for y in [-90,80]:
 notch=Part.makeBox(20,10,22,V(-10,y,33)).fuse(Part.makeBox(28,10,18,V(-14,y,37)))
 notch=notch.multiFuse([Part.makeCylinder(4,10,V(x,y,37),V(0,1,0)) for x in [-10,10]])
 s=s.cut(notch)
s=s.cut(holes(4,4)).cut(holes(4,4,7.5,True)).removeSplitter()
# Separate the carrying wall from the grid deck; retain the standard feet and sockets.
# Deck boundary grows at 45 degrees outside the standard feet and stays inside the old groove.
core=loft([(-.1,167.5,167.5,3.75),(4.75,167.5,167.5,3.75),(4.95,167.9,167.9,3.95),(7,167.9,167.9,3.95),(7.25,168.4,168.4,4.2),(13,168.4,168.4,4.2)])
deck=s.common(core).removeSplitter()
# The wall starts on the bed. Its inner edge grows gradually inward after the stacking groove.
# Three mm rise also keeps the rounded-corner transition at least 45 degrees from horizontal.
wall_void=loft([(4.7,172.6,172.6,4.3),(7,172.6,172.6,4.3),(10,168.8,168.8,4.4),(12,168.8,168.8,4.4),(12.25,168.5,168.5,2.25),(55,168.5,168.5,2.25)])
wall=s.common(Part.makeBox(200,200,50,V(-100,-100,4.75))).cut(wall_void).removeSplitter()
wp=wall.copy();wp.translate(V(0,0,-4.75))
save('carrier-grid-deck',deck,4,4,'magnetic grid deck; print feet down')
save('carrier-wall',wp,4,4,'carrying wall; print flat lower rim down; bond to deck')
shapes['carrier-wall']=wall
s=Part.makeCompound([deck,wall]);shapes['carrier-4x4-stacking']=s
s.exportStep(str(R/'carrier-assembly.step'))
assert deck.common(wall).Volume<.001
assert .045<deck.distToShape(wall)[0]<.205

# Optional small bin reproduces a complete magnetic foot and its stacking receiver.
coupon=shapes['bin-1x1-open'];checks=[]
def moved(s,x=0,y=0,z=0):
 t=s.copy();t.translate(V(x,y,z));return t
def no_overlap(a,b,label):
 v=a.common(b).Volume;assert v<.001,(label,v);return v
# Every bin seats on the carrier; every matching-footprint bin stacks with the other layouts.
for name,nx,ny,div in specs:
 p=moved(shapes[name],centers(4)[0]+(nx-1)*21,centers(4)[0]+(ny-1)*21,7.5)
 checks.append(dict(test=name+' carrier fit',overlap_mm3=no_overlap(s,p,name)))
 for other,ox,oy,od in specs:
  if (ox,oy)==(nx,ny):
   upper=moved(shapes[other],z=29.4);v=no_overlap(shapes[name],upper,name+' stack '+other)
   distance=shapes[name].distToShape(upper)[0];assert distance<1e-5,(name,'no supporting contact',distance)
   checks.append(dict(test=name+' under '+other,overlap_mm3=v,support_distance_mm=distance))
upper=moved(s,z=42);v=no_overlap(s,upper,'carrier stack');distance=s.distToShape(upper)[0];assert distance<1e-5,distance
checks.append(dict(test='carrier on carrier',overlap_mm3=v,support_distance_mm=distance,stack_pitch_mm=42,lip_vertical_clearance_mm=.25))
layout=[('bin-2x4-four',-42,0),('bin-1x2-open',21,-42),('bin-1x1-open',63,-63),('bin-1x1-open',63,-21),('bin-2x2-open',42,42)]
placed=[moved(shapes[n],x,y,7.5) for n,x,y in layout]
for i,a in enumerate(placed):
 no_overlap(s,a,'layout carrier');no_overlap(upper,a,'loaded stack overhead')
 for b in placed[i+1:]:no_overlap(a,b,'neighbor bins')
checks.append(dict(test='full 16-cell mixed layout and loaded carrier stack',overlap_mm3=0,minimum_vertical_clearance_mm=42-(7.5+33)))
Part.makeCompound([s]+placed).exportStep(str(R/'loaded-assembly.step'))
Part.makeCompound([s]+placed+[upper]+[moved(p,z=42) for p in placed]).exportStep(str(R/'stacked-assembly.step'))
# Browser meshes come from validated export-quality mesh tessellation.
for name,shape in shapes.items():
 m=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.045,AngularDeflection=.14,Relative=False);vs,fs=m.Topology
 (R/(name+'.mesh.json')).write_text(json.dumps(dict(vertices=[list(v) for v in vs],faces=fs)))
doc.recompute();doc.saveAs(str(R/'portable-grid-workspace.FCStd'))
(R/'validation.json').write_text(json.dumps(dict(models=records,checks=checks,layout=layout,grid_pitch_mm=42,bin_stack_pitch_mm=29.4,carrier_stack_pitch_mm=42,carrier_footprint_mm=176,bin_pocket_mm=[6.2,2.4],physical_validation='pending; CAD checks only',footprint_area_reduction_percent=100*(1-176**2/209.5**2)),indent=2))
print('ALL CHECKS PASS',flush=True)
