import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, Rectangle
from matplotlib import patheffects
sys.path.insert(0,str(Path(__file__).resolve().parent))
import design as new
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'paver-feet-c01'))
import importlib.util
spec=importlib.util.spec_from_file_location('old_design',Path(__file__).resolve().parent.parent/'paver-feet-c01/design.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
fig,axs=plt.subplots(1,2,figsize=(12,6),facecolor='#101820')
for ax,d,title in zip(axs,[old,new],['C01 · current 76 mm','C02 · concept 98 mm']):
 ax.set_facecolor('#15232b');b=d.BASE_WIDTH/2
 ax.add_patch(Rectangle((-b,-b),2*b,2*b,facecolor='#566069',edgecolor='#a9b5b7',lw=2))
 ax.add_patch(Circle((0,0),d.RIM_IN,facecolor='#15232b',edgecolor='#a9b5b7',lw=1.5))
 ax.add_patch(Circle((0,0),d.RIM_OUT,fill=False,edgecolor='#a9b5b7',lw=2))
 for i in range(4):ax.add_patch(Polygon(d.rib_outline(i),closed=True,facecolor='#2fc8bf',edgecolor='#a9ffed',lw=1))
 ax.add_patch(Polygon(d.pad_outline(),closed=True,facecolor='#15938e',edgecolor='#a9ffed',lw=1.5))
 ax.add_patch(Rectangle((-12,-12),24,24,facecolor='#15232b',edgecolor='#a9ffed',lw=1))
 ax.set(xlim=(-54,54),ylim=(-54,54),aspect='equal',title=title)
 ax.axis('off');ax.title.set_color('white');ax.title.set_fontsize(17)
 ax.annotate('pad root',xy=(25,1),xytext=(12,-47),color='white',arrowprops={'arrowstyle':'->','color':'white'})
 ax.annotate('ring root',xy=(d.RIM_IN,4),xytext=(20,48),color='white',arrowprops={'arrowstyle':'->','color':'white'})
fig.text(.5,.06,'Top view · same 48 mm load pad · teal = moving flexures · gray = shelf-side frame',ha='center',color='white',fontsize=12)
fig.text(.5,.015,'C02 has a wider arm and tapered root flares; extra 7 mm overall height preserves travel.',ha='center',color='#c2d1d1',fontsize=11)
fig.tight_layout(rect=(0,.1,1,1));fig.savefig('C01-vs-C02-top.png',dpi=180,facecolor=fig.get_facecolor())
