"""Taller diffuser with continuous lapped roof seat and raised cam contact."""
from pathlib import Path
from build123d import *
from twist_lock import lb,turn,components
import json,numpy as np,math,shutil
R=Path(__file__).parent;B=R/'draft-08';D=R/'draft-09';D.mkdir(exist_ok=True)
for folder in ['parts','meshes','review']:
 if not (D/folder).exists():shutil.copytree(B/folder,D/folder)
for f in B.glob('*'):
 if f.is_file() and f.suffix!='.step':shutil.copy(f,D/f.name)
def box(x,y,z,dx,dy,dz):return Pos(x,y,z)*Box(dx,dy,dz,align=(Align.MIN,)*3)
def save(n,s):
 assert s.is_valid and len(s.solids())==1,(n,s.is_valid,len(s.solids()))
 export_step(s,D/'parts'/(n+'.step'));export_stl(s,D/'parts'/(n+'.stl'),tolerance=.06,angular_tolerance=.1)
 v,t=s.tessellate(.06,.1);np.savez_compressed(D/'meshes'/(n+'.npz'),v=np.array([tuple(p) for p in v]),t=np.array(t))
sides=[('front',(-160,-160),(1,0),(0,1),320),('right',(176,-144),(0,1),(-1,0),288),('back',(160,160),(-1,0),(0,-1),320),('left',(-176,144),(0,-1),(1,0),288)]
def angle(u,L):return math.radians(25)*min(1,max(0,u/32),max(0,(L-u)/32))
def ribbon(path,q0,q1,k0,k1,shift=(0,0)):
 wires=[]
 for p,t,n,u,a in path:
  pts=[(p[0]+t[0]*u+n[0]*(math.sin(a)*q+math.cos(a)*k)+shift[0],p[1]+t[1]*u+n[1]*(math.sin(a)*q+math.cos(a)*k)+shift[1],18+math.cos(a)*q-math.sin(a)*k) for q,k in [(q0,k0),(q1,k0),(q1,k1),(q0,k1)]]
  wires.append(Wire.make_polygon(pts,close=True))
 return Solid.make_loft(wires,ruled=True)
paths=[]
for name,p,t,n,L in sides:
 for suffix,lo,hi in [('a',34,L/2-.15),('b',L/2+.15,L-34)]:paths.append((name+'-'+suffix,[(p,t,n,lo,math.radians(25)),(p,t,n,hi,math.radians(25))],(0,0)))
for cname,ia,ib,cx,cy,start,end in [('front-right',0,1,160,-144,-90,0),('rear-right',1,2,160,144,0,90),('rear-left',2,3,-160,144,90,180),('front-left',3,0,-160,-144,180,270)]:
 path=[]
 for idx,last in [(ia,True),(ib,False)]:
  _,p,t,n,L=sides[idx]
  if last:
   for u in np.linspace(L-33.6,L,10):path.append((p,t,n,u,angle(u,L)))
   for deg in np.linspace(start,end,25)[1:-1]:
    a=math.radians(deg);path.append(((cx+16*math.cos(a),cy+16*math.sin(a)),(-math.sin(a),math.cos(a)),(-math.cos(a),-math.sin(a)),0,0))
  else:
   for u in np.linspace(0,33.6,10):path.append((p,t,n,u,angle(u,L)))
 paths.append((cname,path,(.07 if cx>0 else -.07,.07 if cy>0 else -.07)))
# Original 0.6 mm wall, now 10.3 mm tall; top laps the roof seat by 1.3 mm.
# Keep a 0.7 mm open upper entry above it for installation.
seat=[];cuts=[]
for name,path,shift in paths:
 save('diffuser-'+name,ribbon(path,-4.7,5.6,3.2,3.8,shift))
 seat.append(ribbon(path,4.3,6.3,1.7,3.2,shift))
 cuts.append(ribbon(path,4.15,6.3,3.2,9,shift))
 if name not in ['front-right','rear-right','rear-left','front-left']:
  length=125.85 if name.startswith(('front','back')) else 109.85
  save('diffuser-'+name+'-flat',box(0,0,0,length,10.3,.6))
peg=import_step(R/'draft-06/parts/retaining-peg.step')+(Pos(-1.1,-4.8,4.3)*Rot(Y=90)*Cylinder(.5,2.2,align=(Align.CENTER,Align.CENTER,Align.MIN)))
save('retaining-peg',peg);save('retaining-peg-print',Pos(0,0,1.4)*Rot(Y=-90)*peg)
m=json.loads((B/'retention.json').read_text());_,_,void,_,_=components();clear=[];planes=[]
cam=Pos(-1.25,-4.8,4.3)*Rot(Y=90)*Cylinder(.65,2.5,align=(Align.CENTER,Align.CENTER,Align.MIN))
sweep=turn(cam,0).fuse(*[turn(cam,a) for a in range(5,91,5)])
for rec in m['pegs']:
 pl=Plane(origin=rec['origin'],x_dir=(*rec['tangent'],0),z_dir=rec['normal']);planes.append(pl)
 clear.append(pl.location*sweep)
 clear.append(pl.location*(Pos(0,-8,2.7)*Cylinder(2.15,1.5,align=(Align.CENTER,Align.CENTER,Align.MIN))))
 for k in [0,1,2]:clear.append(pl.location*(Pos(0,0,k)*void))
 s=pl.location*peg;v,t=s.tessellate(.06,.1);np.savez_compressed(D/'meshes'/(rec['name']+'.npz'),v=np.array([tuple(p) for p in v]),t=np.array(t))
regions=[('front',(-117,-200,234,99)),('right',(117,-101,83,202)),('back',(-117,101,234,99)),('left',(-200,-101,83,202)),('front-left',(-200,-200,83,99)),('front-right',(117,-200,83,99)),('rear-right',(117,101,83,99)),('rear-left',(-200,101,83,99))]
for name,(x,y,w,h) in regions:
 clip=box(x,y,-1,w,h,40);s=import_step(B/'parts'/(name+'.step'))
 localcuts=[v for c in cuts if getattr(v:=c&clip,'volume',0)>1e-6]
 adds=[v for c in seat if getattr(v:=c&clip,'volume',0)>1e-6]
 if localcuts:s=s.cut(*localcuts)
 if adds:
  add=adds[0].fuse(*adds[1:]) if len(adds)>1 else adds[0]
  add=add.cut(*clear);s=s+add
 s=s.cut(*clear)
 save(name,s);print(name,'done',flush=True)
save('fit-coupon-keeper',import_step(D/'parts/front.step')&box(-116,-190,0,24,60,35))
save('fit-coupon-diffuser',box(0,0,0,23.6,10.3,.6))
m.update(diffuser_height_mm=10.3,roof_overlap_mm=1.3,roof_seat='Continuous sloped back face k=3.2, q4.3 to6.3; diffuser top q5.6',cam='Rounded nose raised to q4.8, directly opposite lapped roof seat',upper_entry_clearance_mm=.7)
(D/'retention.json').write_text(json.dumps(m,indent=2));print('Draft 09 roof lap generated',flush=True)
