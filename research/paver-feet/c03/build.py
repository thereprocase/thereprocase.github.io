from pathlib import Path
import json
import cadquery as cq
import trimesh
import design as d
O=Path('output');O.mkdir(exist_ok=True)
def cap(side):
 size=d.TOP if side=='upper' else d.BASE
 # Flat paver face (upper) and broad shelf face (lower), geometry in local Z.
 part=(cq.Workplane('XY').rect(size,size) if side=='upper' else cq.Workplane('XY').circle(size/2)).extrude(d.PLATE)
 # External locating wall. Spring wire does not touch it during vertical travel.
 ring=cq.Workplane('XY').workplane(offset=d.PLATE).circle(d.GUIDE_OUT).circle(d.GUIDE_IN).extrude(d.GUIDE_HEIGHT)
 part=part.union(ring)
 if side=='lower':
  # Axial hard stop inside the spring, with room around the coil and moving guide.
  from math import pi
  rate=d.G*d.WIRE**4/(8*d.SPRING_MEAN_D**3*d.ACTIVE)
  post_height=d.SPRING_FREE-d.STOP_FORCE/rate
  post=cq.Workplane('XY').workplane(offset=d.PLATE).circle(12).extrude(post_height)
  part=part.union(post)
 # Tiny rounded vertical edges for handling; load-bearing spring seats stay planar.
 if side=='upper':part=part.edges('|Z').fillet(1.5)
 return part
low=cap('lower');up=cap('upper')
for name,obj in [('lower-seat',low),('upper-seat',up)]:
 assert obj.val().isValid() and len(obj.solids().vals())==1
 cq.exporters.export(obj,str(O/(name+'.step')))
 cq.exporters.export(obj,str(O/(name+'.stl')),tolerance=.06,angularTolerance=.12)
 mesh=trimesh.load_mesh(O/(name+'.stl'))
 assert mesh.is_watertight and len(mesh.split())==1
 print(name,mesh.volume*.00124,'g assuming 1.24 g/cm3')
assembly=cq.Assembly(name='C03_captured_spring_foot')
assembly.add(low,name='lower',color=cq.Color(.26,.36,.42))
# spring sits between facing plate surfaces at z=6 and z=61
upper=up.rotate((0,0,0),(1,0,0),180).translate((0,0,2*d.PLATE+d.SPRING_FREE))
assembly.add(upper,name='upper',color=cq.Color(.07,.56,.57))
# Simplified helical reference, not a spring-manufacturing STEP. The dimensions and end details are specified separately.
helix=cq.Wire.makeHelix((d.SPRING_FREE-d.WIRE)/d.ACTIVE,d.SPRING_FREE-d.WIRE,d.SPRING_MEAN_D/2)
spring=cq.Workplane('XZ').center(d.SPRING_MEAN_D/2,0).circle(d.WIRE/2).sweep(cq.Workplane(obj=helix),isFrenet=True).translate((0,0,d.PLATE+d.WIRE/2))
assembly.add(spring,name='illustrative_spring',color=cq.Color(.70,.72,.75))
assembly.export(str(O/'assembly.step'))
assert low.intersect(spring).val().Volume()<.01
assert upper.intersect(spring).val().Volume()<.01
print('overall height',2*d.PLATE+d.SPRING_FREE)
