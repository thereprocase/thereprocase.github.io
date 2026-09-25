import argparse,json,time
from pathlib import Path
import numpy as np,trimesh,tetgen
from scipy.sparse.linalg import spsolve
from skfem import MeshTet,Basis,ElementTetP1,ElementVector,asm
from skfem.models.elasticity import linear_elasticity,lame_parameters

ap=argparse.ArgumentParser();ap.add_argument('rev',nargs='?',default='c04');ap.add_argument('--volume',type=float,default=12);ap.add_argument('--nu',type=float,default=.45);ap.add_argument('--force',type=float,default=71.78);ap.add_argument('--eccentric',type=float,default=0.0);a=ap.parse_args()
t=time.time();path=Path('output/C04-spring.stl')
surf=trimesh.load_mesh(path);assert surf.is_watertight
print('tet meshing',a.rev,a.volume,flush=True)
tg=tetgen.TetGen(surf.vertices,surf.faces);nodes,tets,_,_=tg.tetrahedralize(order=1,maxvolume=a.volume,fixedvolume=True,quality=False,quiet=True)
mesh=MeshTet(nodes.T,tets.T);basis=Basis(mesh,ElementVector(ElementTetP1()))
print('nodes',len(nodes),'tet',len(tets),'assemble',round(time.time()-t,1),flush=True)
lam,mu=lame_parameters(9.8,a.nu)
K=asm(linear_elasticity(lam,mu),basis).tocsr()
facets=mesh.boundary_facets();tris=mesh.facets[:,facets].T
zmax=nodes[:,2].max();tri_top=tris[np.all(np.abs(nodes[tris,2]-zmax)<.01,axis=1)]
v0,v1,v2=(nodes[tri_top[:,i]] for i in range(3));areas=np.linalg.norm(np.cross(v1-v0,v2-v0),axis=1)/2
F=np.zeros(3*len(nodes))
cent_top=(v0+v1+v2)/3
mean_r2=np.average(cent_top[:,0]**2,weights=areas)
weights=1+a.eccentric*(cent_top[:,0]+cent_top[:,1])/mean_r2
assert weights.min()>0
pressure=a.force/np.sum(areas*weights)
for i in range(3):np.add.at(F,3*tri_top[:,i]+2,-pressure*areas*weights/3)
rim_inner=54.0
fixed_nodes=np.flatnonzero((abs(nodes[:,2])<.01)&(np.linalg.norm(nodes[:,:2],axis=1)>rim_inner-.02));fixed=(3*fixed_nodes[:,None]+np.arange(3)).ravel();free=np.setdiff1d(np.arange(len(F)),fixed)
print('solve',K.shape,K.nnz,'load area',areas.sum(),round(time.time()-t,1),flush=True)
u=np.zeros(len(F));u[free]=spsolve(K[free][:,free],F[free]);dis=u.reshape(-1,3)
reaction=(K@u-F).reshape(-1,3)[fixed_nodes].sum(axis=0)
# Constant strain tetrahedra: gradient of affine u in each cell.
P=nodes[tets];M=(P[:,1:]-P[:,0,None,:]).transpose(0,2,1)
U=dis[tets];A=(U[:,1:]-U[:,0,None,:]).transpose(0,2,1)
grad=np.linalg.solve(M.transpose(0,2,1),A.transpose(0,2,1)).transpose(0,2,1)
eps=(grad+grad.transpose(0,2,1))/2
stress=2*mu*eps+lam*np.trace(eps,axis1=1,axis2=2)[:,None,None]*np.eye(3)
vm=np.sqrt(.5*((stress[:,0,0]-stress[:,1,1])**2+(stress[:,1,1]-stress[:,2,2])**2+(stress[:,2,2]-stress[:,0,0])**2+6*(stress[:,0,1]**2+stress[:,1,2]**2+stress[:,0,2]**2)))
pe=np.linalg.eigvalsh(eps)[:,-1]
ps=np.maximum(0,np.linalg.eigvalsh(stress)[:,-1])
cent=P.mean(axis=1);r=np.linalg.norm(cent[:,:2],axis=1)
regions={'all':np.ones(len(tets),bool),'arms':(r>30)&(r<61)&(cent[:,2]>6)&(cent[:,2]<61),'inner_root':(r>26)&(r<39)&(cent[:,2]>48),'outer_root':(r>54)&(r<66)&(cent[:,2]<14)}
summary={ 'revision':a.rev,'nu':a.nu,'E_MPa':9.8,'force_N':a.force,'eccentricity_xy_mm':a.eccentric,'max_tet_volume_mm3':a.volume,'nodes':len(nodes),'tetrahedra':len(tets),'load_area_mm2':float(areas.sum()),'pressure_MPa':float(pressure),'reaction_N':reaction.tolist(),'pad_mean_displacement_mm':float(-dis[np.unique(tri_top),2].mean()),'pad_range_displacement_mm':[float(-dis[np.unique(tri_top),2].min()),float(-dis[np.unique(tri_top),2].max())], 'solve_seconds':round(time.time()-t,1),'regions':{}}
for k,mask in regions.items():
 summary['regions'][k]={'tetrahedra':int(mask.sum()),'von_mises_MPa_p95_p99_max':[float(x) for x in np.percentile(vm[mask],[95,99,100])], 'max_principal_strain_p95_p99_max':[float(x) for x in np.percentile(pe[mask],[95,99,100])],'max_principal_tensile_MPa_p95_p99_max':[float(x) for x in np.percentile(ps[mask],[95,99,100])]}
out=Path('output/fea');out.mkdir(exist_ok=True);p=out/f'{a.rev}-v{a.volume:g}-nu{a.nu:g}-e{a.eccentric:g}.json';p.write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
np.savez_compressed(out/f'{a.rev}-v{a.volume:g}-nu{a.nu:g}-e{a.eccentric:g}.npz',nodes=nodes,tets=tets,displacements=dis,stress_von_mises=vm,max_principal_strain=pe,max_principal_tensile_MPa=ps)
