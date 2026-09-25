"""Linear 3D seat plate FEA, self-equilibrated face tractions. MPa, mm, N."""
import sys,json
from pathlib import Path
import numpy as np,trimesh,tetgen
from scipy.sparse.linalg import spsolve
from skfem import MeshTet,Basis,ElementVector,ElementTetP1,asm
from skfem.models.elasticity import linear_elasticity,lame_parameters
import design as d
name=sys.argv[1] if len(sys.argv)>1 else 'upper-seat'
F=float(sys.argv[2]) if len(sys.argv)>2 else 133.8607725
volume=float(sys.argv[3]) if len(sys.argv)>3 else 15.0
mesh0=trimesh.load_mesh(f'output/{name}.stl');tg=tetgen.TetGen(mesh0.vertices,mesh0.faces)
nodes,tets,_,_=tg.tetrahedralize(order=1,fixedvolume=True,maxvolume=volume,minratio=1.5)
m=MeshTet(nodes.T,tets.T);basis=Basis(m,ElementVector(ElementTetP1()))
E=1800.;nu=.38;K=asm(linear_elasticity(*lame_parameters(E,nu)),basis).tocsr()
tri=m.facets[:,m.boundary_facets()].T;cent=nodes[tri].mean(axis=1);z=cent[:,2];r=np.linalg.norm(cent[:,:2],axis=1)
spring=(abs(z-d.PLATE)<.02)&(r>22)&(r<29.0)
if name=='upper-seat': load=(abs(z)<.02)&(abs(cent[:,0])<24)&(abs(cent[:,1])<24)
else:load=(abs(z)<.02)
assert spring.sum()>20 and load.sum()>20,(spring.sum(),load.sum())
def distribute(mask,force,vec):
 faces=tri[mask];p=nodes[faces];areas=np.linalg.norm(np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),axis=1)/2
 for j in range(3):np.add.at(vec,3*faces[:,j]+2,force*areas/(3*areas.sum()))
 return float(areas.sum())
vec=np.zeros(3*len(nodes));A1=distribute(spring,F,vec);A2=distribute(load,-F,vec)
# Six independent rigid-body constraints only, away from load interfaces.
idx0=np.argmin(np.linalg.norm(nodes-np.array([0.,0.,0.]),axis=1))
idx1=np.argmin(np.linalg.norm(nodes-np.array([d.TOP/2,0.,0.]),axis=1))
idx2=np.argmin(np.linalg.norm(nodes-np.array([0.,d.TOP/2,0.]),axis=1))
fixed=np.array([3*idx0,3*idx0+1,3*idx0+2,3*idx1+1,3*idx1+2,3*idx2+2]);free=np.setdiff1d(np.arange(len(vec)),fixed)
u=np.zeros(len(vec));u[free]=spsolve(K[free][:,free],vec[free]);disp=u.reshape(-1,3)
P=nodes[tets];U=disp[tets]
M=(P[:,1:]-P[:,0,None,:]).transpose(0,2,1);V=(U[:,1:]-U[:,0,None,:]).transpose(0,2,1)
grad=np.linalg.solve(M.transpose(0,2,1),V.transpose(0,2,1)).transpose(0,2,1);eps=(grad+grad.transpose(0,2,1))/2
lam,mu=lame_parameters(E,nu);stress=2*mu*eps+lam*np.trace(eps,axis1=1,axis2=2)[:,None,None]*np.eye(3)
sig=np.maximum(0,np.linalg.eigvalsh(stress)[:,-1]);p99=np.percentile(sig,99);mx=np.max(sig)
result={'part':name,'force_N':F,'tetrahedra':len(tets),'max_tet_volume_mm3':volume,'material':'isotropic PETG screen E=1800 MPa, nu=.38','assumed_min_printed_tensile_MPa':20.,'spring_contact_area_mm2':A1,'opposite_contact_area_mm2':A2,'positive_max_principal_tensile_MPa_p99':float(p99),'positive_max_principal_tensile_MPa_max':float(mx),'FoS_p99':float(20/p99),'FoS_max':float(20/mx),'max_displacement_mm':float(np.linalg.norm(disp,axis=1).max())}
Path(f'output/{name}-fea-v{volume:g}.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
