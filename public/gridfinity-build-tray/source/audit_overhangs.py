"""Audit exported, print-oriented binary STL. Horizontal bridges are reported separately."""
from pathlib import Path
import struct,math,json
R=Path(__file__).resolve().parent
out={}
for path in sorted((R/'models').glob('*.stl')):
 data=path.read_bytes();count=struct.unpack_from('<I',data,80)[0];horizontal={};slopes=[];steep=[];substantial=[]
 for i in range(count):
  v=struct.unpack_from('<12fH',data,84+50*i);a=v[3:6];b=v[6:9];c=v[9:12];u=[b[j]-a[j] for j in range(3)];w=[c[j]-a[j] for j in range(3)];n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];l=math.sqrt(sum(x*x for x in n));z=sum(x[2] for x in [a,b,c])/3
  if not l or n[2]>=-1e-7 or z<.005:continue
  angle=math.degrees(math.acos(min(1,-n[2]/l)));area=l/2
  if angle<.05:
   key=round(z,3);horizontal[key]=horizontal.get(key,0)+area
  elif area>.0001:
   slopes.append(angle)
   if area>=.01:substantial.append(angle)
   if angle<44.5:steep.append(dict(angle=round(angle,3),area=area,z=round(z,3)))
 out[path.stem]=dict(horizontal_downfaces_by_z_mm={k:round(v,3) for k,v in sorted(horizontal.items())},minimum_downward_slope_degrees_from_horizontal=round(min(slopes),3) if slopes else None,minimum_slope_for_facets_at_least_0_01_mm2=round(min(substantial),3) if substantial else None,below_44_5_degrees_area_mm2=round(sum(x['area'] for x in steep),4),below_44_5_degrees_examples=sorted(steep,key=lambda x:x['angle'])[:8])
(R/'overhang-audit.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))

for name,v in out.items():
 flat=v['horizontal_downfaces_by_z_mm']
 if name.startswith('bin-') or name=='carrier-grid-deck':assert set(flat).issubset({2.4,4.75}),(name,flat)
 else:assert not flat,(name,flat)
 a=v['minimum_slope_for_facets_at_least_0_01_mm2'];assert a is None or a>=44,(name,a)
print('OVERHANG CHECKS PASS; nominal 45-degree curves allow mesh tessellation error; tiny facets reported separately')
