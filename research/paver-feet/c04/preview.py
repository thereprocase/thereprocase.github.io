import numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon,Circle,Rectangle
import design as d
q=np.load('output/fea/c04-v8-nu0.49-e2.npz');P=q['nodes'][q['tets']].mean(axis=1);S=q['max_principal_tensile_MPa']
fig,axs=plt.subplots(1,2,figsize=(13,7),facecolor='#101b23',gridspec_kw={'width_ratios':[1,1.15]})
for ax in axs:ax.set_facecolor('#172832');ax.tick_params(colors='white');ax.spines[:].set_color('#687d81')
ax=axs[0];poly=d.wall_polygon();ax.add_patch(Polygon(poly,facecolor='#1c8585',edgecolor='#a5e9df',lw=1.4))
ax.add_patch(Rectangle((d.BASE_IN,0),d.BASE_OUT-d.BASE_IN,d.BASE_THICK,facecolor='#176d70',edgecolor='#a5e9df'))
ax.add_patch(Rectangle((d.TOP_IN,d.TOP_Z),d.TOP_OUT-d.TOP_IN,d.TOP_THICK,facecolor='#20a7a3',edgecolor='#a5e9df'))
mask=(P[:,0]>0)&(abs(P[:,1])<1.5)&(P[:,2]>5)&(P[:,2]<82)
ind=np.flatnonzero(mask)[::max(1,mask.sum()//5000)]
sc=ax.scatter(P[ind,0],P[ind,2],c=S[ind],s=7,cmap='inferno',vmin=0,vmax=1.75,alpha=.8,rasterized=True)
ax.set(xlim=(15,78),ylim=(-3,91),xlabel='Radius (mm)',ylabel='Height (mm)',title='One-piece spring · section & FEA')
ax.set_xlabel('Radius (mm)',color='white');ax.set_ylabel('Height (mm)',color='white');ax.title.set_color('white')
cb=fig.colorbar(sc,ax=ax,shrink=.75,pad=.02);cb.set_label('Max principal tension (MPa)',color='white');cb.ax.tick_params(colors='white')
ax=axs[1];side=398.78
ax.add_patch(Rectangle((-side/2,-side/2),side,side,facecolor='#42525b',edgecolor='#c9dad9',lw=2))
for x in [-side/2+80,side/2-80]:
 for y in [-side/2+80,side/2-80]:
  ax.add_patch(Circle((x,y),70,facecolor='#117d7b',edgecolor='#8de5d7',lw=1.5))
  ax.add_patch(Circle((x,y),37,facecolor='#1e9c97',edgecolor='#baf2e5',lw=1))
  ax.add_patch(Circle((x,y),23,facecolor='#42525b',edgecolor='#baf2e5',lw=1))
ax.set(xlim=(-220,220),ylim=(-220,220),aspect='equal',title='Four feet under 399 mm paver')
ax.title.set_color('white');ax.axis('off')
fig.subplots_adjust(bottom=.18)
fig.text(.5,.08,'C04 · Ø140 mm × 86 mm · 4.5 mm wall · 185 g TPU per foot · 134 N peak corner load',ha='center',color='white',fontsize=12)
fig.text(.5,.04,'Linear model: peak tension 1.74 MPa in the stiff material case; tensile FoS ≥ 4 requires measured print strength ≥ 7.0 MPa.',ha='center',color='#c3d1d0',fontsize=10)
fig.savefig('output/C04-preview.png',dpi=165,bbox_inches='tight',facecolor=fig.get_facecolor())
