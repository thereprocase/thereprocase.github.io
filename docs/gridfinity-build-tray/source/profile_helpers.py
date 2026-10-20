def wire(w,h,r,z,cx=0,cy=0):
 x0,x1=cx-w/2,cx+w/2;y0,y1=cy-h/2,cy+h/2;es=[]
 pts=[(x0+r,y0),(x1-r,y0),(x1,y0+r),(x1,y1-r),(x1-r,y1),(x0+r,y1),(x0,y1-r),(x0,y0+r)]
 for a,b in [(0,1),(2,3),(4,5),(6,7)]:es.append(Part.makeLine(V(*pts[a],z),V(*pts[b],z)))
 for cx1,cy1,a0 in [(x1-r,y0+r,-90),(x1-r,y1-r,0),(x0+r,y1-r,90),(x0+r,y0+r,180)]:
  es.append(Part.ArcOfCircle(Part.Circle(V(cx1,cy1,z),V(0,0,1),r),math.radians(a0),math.radians(a0+90)).toShape())
 return Part.Wire(Part.sortEdges(es)[0])
def loft(sections,cx=0,cy=0):return Part.makeLoft([wire(w,h,r,z,cx,cy) for z,w,h,r in sections],True,True)
