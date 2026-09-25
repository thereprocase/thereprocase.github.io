"""C01 square flat-top corner feet: two support-free TPU parts per foot."""
from pathlib import Path
import json
import cadquery as cq
import trimesh
import design as d

OUT=Path('output');OUT.mkdir(exist_ok=True)

def ring(outer,inner,height,z=0):
    return cq.Workplane('XY').workplane(offset=z).circle(outer).circle(inner).extrude(height)

def square_frame(inner,z,h):
    return cq.Workplane('XY').workplane(offset=z).rect(d.BASE_WIDTH,d.BASE_WIDTH).circle(inner).extrude(h)

def build():
    base=square_frame(d.RIM_IN,0,d.SEAT_Z)
    base=base.union(square_frame(d.RIM_OUT+.25,d.SEAT_Z,3))
    base=base.union(cq.Workplane('XY').rect(18,18).extrude(d.STOP_Z))
    for angle in [0,90,180,270]:
        spoke=cq.Workplane('XY').center(25,0).rect(47,6).extrude(2)
        base=base.union(spoke.rotate((0,0,0),(0,0,1),angle))
    top=cq.Workplane('XY').polyline(d.pad_outline()).close().extrude(d.PLATFORM_TOP)
    # Open central recess saves material without a printed roof or bridge.
    # The paver itself spans the 24 mm recess, bearing on the surrounding flat pad.
    recess=cq.Workplane('XY').workplane(offset=4).rect(24,24).extrude(d.PLATFORM_TOP)
    top=top.cut(recess)
    top=top.union(ring(d.RIM_OUT,d.RIM_IN,d.RIB_HEIGHT))
    for i in range(4):
        arm=cq.Workplane('XY').polyline(d.rib_outline(i).tolist()).close().extrude(d.RIB_HEIGHT)
        top=top.union(arm)
    return base,top

def main():
    base,top=build();stats={}
    for name,part in [('base',base),('floating-pad',top)]:
        assert part.val().isValid() and len(part.solids().vals())==1,name
        cq.exporters.export(part,str(OUT/f'{name}.step'))
        cq.exporters.export(part,str(OUT/f'{name}.stl'),tolerance=.035,angularTolerance=.08)
        mesh=trimesh.load_mesh(OUT/f'{name}.stl')
        mesh.update_faces(mesh.nondegenerate_faces());mesh.update_faces(mesh.unique_faces());mesh.remove_unreferenced_vertices()
        assert mesh.is_watertight and mesh.is_winding_consistent and len(mesh.split())==1 and mesh.volume>0,name
        assert abs(mesh.bounds[0,2])<1e-6
        mesh.export(OUT/f'{name}.stl')
        stats[name]=dict(bounds_mm=mesh.bounds.tolist(),volume_mm3=float(mesh.volume),
                         watertight=True,triangles=len(mesh.faces),estimated_mass_g=float(mesh.volume*.00122))
    installed=top.translate((0,0,d.SEAT_Z))
    assert base.intersect(installed).val().Volume()<1e-6
    assembly=cq.Assembly(name=d.REVISION+'_paver_corner_foot')
    assembly.add(base,name='base',color=cq.Color(.34,.38,.44))
    assembly.add(installed,name='floating_pad',color=cq.Color(.0,.56,.63))
    assembly.export(str(OUT/'assembly.step'))
    # Reference slab for contact/clearance checks; not exported as printable CAD.
    slab=cq.Workplane('XY').box(d.BASE_WIDTH,d.BASE_WIDTH,45,centered=(True,True,False)).translate((0,0,d.PAVER_Z))
    assert base.intersect(slab).val().Volume()<1e-6
    assert installed.intersect(slab).val().Volume()<1e-6
    # Ensure ribs and pad do not touch the outer ring anywhere except their designed roots.
    stats['assembly']=dict(width_mm=d.BASE_WIDTH,height_under_paver_mm=d.PAVER_Z,
        seat_z_mm=d.SEAT_Z,stop_gap_mm=d.SEAT_Z-d.STOP_Z,
        paver_to_rim_gap_mm=d.PLATFORM_TOP-d.RIB_HEIGHT,
        pad_width_mm=2*d.PAD_HALF,pad_recess_width_mm=24,pad_bearing_area_mm2=(2*d.PAD_HALF)**2-2*d.PAD_CHAMFER**2-24**2,
        paver_reference_side_mm=d.PAVER_SIDE_REFERENCE,paver_reference_thickness_mm=d.PAVER_THICKNESS_REFERENCE,
        paver_reference_mass_kg=d.PAVER_MASS,printer_mass_kg=d.PRINTER_MASS,
        rib_width_mm=d.RIB_WIDTH,rib_height_mm=d.RIB_HEIGHT,rib_sweep_deg=d.SWEEP_DEG,
        socket_radial_clearance_mm=.25,alignment_lips=False,parts_per_foot=2)
    assert stats['assembly']['height_under_paver_mm']<=45.1
    (OUT/'geometry.json').write_text(json.dumps(stats,indent=2))
    print(json.dumps(stats,indent=2))

if __name__=='__main__':main()
