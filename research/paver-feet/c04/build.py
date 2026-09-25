import cadquery as cq,design as d,trimesh,json
from pathlib import Path
O=Path('output');O.mkdir(exist_ok=True)
wall=cq.Workplane('XZ').polyline(d.wall_polygon().tolist()).close().revolve(360,(0,0),(0,1))
base=cq.Workplane('XY').circle(d.BASE_OUT).circle(d.BASE_IN).extrude(d.BASE_THICK)
top=cq.Workplane('XY').workplane(offset=d.TOP_Z).circle(d.TOP_OUT).circle(d.TOP_IN).extrude(d.TOP_THICK)
part=wall.union(base).union(top)
assert part.val().isValid() and len(part.solids().vals())==1
cq.exporters.export(part,str(O/'C04-spring.step'))
cq.exporters.export(part,str(O/'C04-spring.stl'),tolerance=.065,angularTolerance=.12)
m=trimesh.load_mesh(O/'C04-spring.stl');assert m.is_watertight and len(m.split())==1
print('bounds',m.bounds,'mass TPU',m.volume*.00122,'g','tris',len(m.faces))
