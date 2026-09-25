import numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle,Circle
import design as d
fig,axs=plt.subplots(1,2,figsize=(12,6),facecolor='#111b23')
for ax in axs:ax.set_facecolor('#172631');ax.axis('off')
ax=axs[0]
ax.add_patch(Rectangle((-d.BASE/2,0),d.BASE,d.PLATE,color='#344e59',ec='#b6d2d4',lw=2))
ax.add_patch(Rectangle((-d.TOP/2,d.PLATE+d.SPRING_FREE),d.TOP,d.PLATE,color='#1b9b98',ec='#b6f9ef',lw=2))
post_h=d.SPRING_FREE-d.STOP_FORCE/(d.G*d.WIRE**4/(8*d.SPRING_MEAN_D**3*d.ACTIVE))
ax.add_patch(Rectangle((-12,d.PLATE),24,post_h,color='#344e59',ec='#b6d2d4',lw=1.5))
for x in [-d.GUIDE_OUT,d.GUIDE_IN]:
 ax.add_patch(Rectangle((x-1.5,d.PLATE),3,d.GUIDE_HEIGHT,color='#344e59'))
 ax.add_patch(Rectangle((x-1.5,d.PLATE+d.SPRING_FREE-d.GUIDE_HEIGHT),3,d.GUIDE_HEIGHT,color='#1b9b98'))
z=np.linspace(d.PLATE+d.WIRE/2,d.PLATE+d.SPRING_FREE-d.WIRE/2,600)
for sign in [-1,1]:
 x=sign*(d.SPRING_MEAN_D/2+d.WIRE/2*np.cos(2*np.pi*d.ACTIVE*(z-z.min())/(z.max()-z.min())))
 ax.plot(x,z,color='#dfd9b4',lw=3)
ax.annotate('metal spring',xy=(d.SPRING_MEAN_D/2,40),xytext=(32,57),color='white',arrowprops={'arrowstyle':'->','color':'white'})
ax.annotate('compression stop',xy=(0,d.PLATE+post_h),xytext=(-48,42),color='white',arrowprops={'arrowstyle':'->','color':'white'})
ax.annotate('paver face',xy=(0,70),xytext=(-28,81),color='white',arrowprops={'arrowstyle':'->','color':'white'})
ax.annotate('',xy=(47,0),xytext=(47,70),arrowprops={'arrowstyle':'<->','color':'white'})
ax.text(49,35,'70 mm free',color='white',rotation=90,va='center')
ax.set(xlim=(-62,65),ylim=(-6,87),aspect='equal',title='C03 · section at rest');ax.title.set_color('white');ax.title.set_fontsize(16)
ax=axs[1]
ax.add_patch(Rectangle((-38,-38),76,76,facecolor='#1b9b98',edgecolor='#a7f3e9',lw=2))
ax.add_patch(Circle((0,0),35,facecolor='#344e59',edgecolor='#b6d2d4',lw=2))
for r,c,lw in [(33,'#9fb5b9',2),(27.5,'#e5d8b1',4),(12,'#819ea6',2)]:ax.add_patch(Circle((0,0),r,fill=False,edgecolor=c,lw=lw))
ax.text(0,11,'stop',ha='center',color='white');ax.text(0,28,'spring',ha='center',color='#fff1c7');ax.text(0,40,'76 mm paver pad',ha='center',color='white')
ax.set(xlim=(-48,48),ylim=(-48,48),aspect='equal',title='Top-view footprint');ax.title.set_color('white');ax.title.set_fontsize(16)
fig.text(.5,.055,'5 mm A228 wire · 50 mm mean coil diameter · 5 active turns · 58 mm free spring · 70 mm overall foot',ha='center',color='white',fontsize=11)
fig.text(.5,.02,'Reference spring rate 9.91 N/mm; flat printed seats carry compression; illustration shows nominal envelope, not end-coil detail.',ha='center',color='#b8c8c9',fontsize=10)
fig.savefig('output/C03-preview.png',dpi=170,bbox_inches='tight',facecolor=fig.get_facecolor())
