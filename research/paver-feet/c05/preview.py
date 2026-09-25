import numpy as np
import matplotlib.pyplot as plt
from design import *

t = np.linspace(0,2*np.pi,480)
z = np.linspace(0,HEIGHT,150)
T,Z = np.meshgrid(t,z)
R = radius(T,Z)
X,Y = R*np.cos(T), R*np.sin(T)
fig = plt.figure(figsize=(13,5),facecolor='#f4f1eb')
ax=fig.add_subplot(121,projection='3d')
ax.plot_surface(X,Y,Z,cmap='plasma',rstride=3,cstride=4,linewidth=0,antialiased=True,alpha=.97)
ax.view_init(elev=23,azim=30)
ax.set(xlim=(-70,70),ylim=(-70,70),zlim=(0,80),xlabel='x / mm',ylabel='y / mm',zlabel='height / mm')
ax.set_title('C05: 10-petal continuous vase spring',fontsize=13)
ax.set_box_aspect((1,1,.8))
ax2=fig.add_subplot(122)
for zz,color in [(0,'#444444'),(HEIGHT*.25,'#d55e00'),(HEIGHT*.5,'#8d1ca3'),(HEIGHT*.75,'#1978ad'),(HEIGHT,'#119970')]:
    r=radius(t,zz)
    ax2.plot(r*np.cos(t),r*np.sin(t),color=color,lw=2,label=f'z = {zz:.1f} mm')
ax2.set_aspect('equal');ax2.grid(alpha=.25);ax2.legend(loc='lower left',fontsize=9)
ax2.set(xlabel='x / mm',ylabel='y / mm',title='Petal outline at five heights',xlim=(-75,75),ylim=(-75,75))
fig.text(.5,.025,'Ø125 mm max  •  50 mm high  •  1.0 mm single wall  •  ~20 g TPU  •  0.16 mm spiral pitch',ha='center',fontsize=11)
fig.tight_layout(rect=(0,.05,1,1))
fig.savefig('output/C05-preview.png',dpi=180)
