/** Rigid XY placement only: source geometry and Z remain unchanged. */
export function footprintHull(vertices){
 const unique=new Map();for(let i=0;i<vertices.length;i+=3){const x=vertices[i],y=vertices[i+1];if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid footprint coordinate.');unique.set(x+','+y,[x,y]);}
 const points=[...unique.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(!points.length)throw Error('Empty footprint.');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of points.toReversed()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return points.length===1?points:[...lower.slice(0,-1),...upper.slice(0,-1)];
}
export function placementAtAngle(hull,width,depth,angle=0){
 if(!Number.isFinite(width)||!Number.isFinite(depth)||width<=0||depth<=0||!Number.isFinite(angle))throw Error('Invalid bed placement.');
 const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const [x,y] of hull){const rx=c*x-s*y,ry=s*x+c*y;minX=Math.min(minX,rx);maxX=Math.max(maxX,rx);minY=Math.min(minY,ry);maxY=Math.max(maxY,ry);}
 const w=maxX-minX,d=maxY-minY;return {angle,width:w,depth:d,x:width/2-(minX+maxX)/2,y:depth/2-(minY+maxY)/2,score:Math.max(w/width,d/depth),fits:w<=width+.001&&d<=depth+.001,c,s};
}
/** Minimize the required rectangular-bed scale over a full half-turn.
 * Between support events, each span is A cos(theta) + B sin(theta).
 * A minimum of max(spanX/W, spanY/D) is therefore at an interval end,
 * a stationary point of either span, or an intersection of the two.
 * This is rectangular containment, not minimum-area bounding rectangle.
 */
export function bestPlacement(hull,width,depth){
 if(!hull.length||hull.some(p=>p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw Error('Invalid footprint.');
 let best=placementAtAngle(hull,width,depth,0);
 const pi=Math.PI,mod=a=>((a%pi)+pi)%pi,events=[0,pi];
 for(let i=0;i<hull.length;i++){
  const a=hull[i],b=hull[(i+1)%hull.length],dx=b[0]-a[0],dy=b[1]-a[1];
  if(dx===0&&dy===0)continue;
  const edge=Math.atan2(dy,dx);events.push(mod(-edge),mod(pi/2-edge));
 }
 events.sort((a,b)=>a-b);
 const knots=events.filter((a,i)=>!i||a-events[i-1]>1e-14);
 let candidates=1;
 const consider=a=>{
  const p=placementAtAngle(hull,width,depth,a*180/pi);candidates++;
  if(p.score<best.score-1e-13||(Math.abs(p.score-best.score)<=1e-13&&p.angle<best.angle))best=p;
 };
 for(let i=0;i<knots.length-1;i++){
  const lo=knots[i],hi=knots[i+1],mid=(lo+hi)/2,c=Math.cos(mid),s=Math.sin(mid);
  let left=hull[0],right=left,bottom=left,top=left;
  for(const p of hull){
   if(c*p[0]-s*p[1]<c*left[0]-s*left[1])left=p;
   if(c*p[0]-s*p[1]>c*right[0]-s*right[1])right=p;
   if(s*p[0]+c*p[1]<s*bottom[0]+c*bottom[1])bottom=p;
   if(s*p[0]+c*p[1]>s*top[0]+c*top[1])top=p;
  }
  const ax=(right[0]-left[0])/width,bx=-(right[1]-left[1])/width,
        ay=(top[1]-bottom[1])/depth,by=(top[0]-bottom[0])/depth;
  consider(lo);
  for(const a of [mod(Math.atan2(bx,ax)),mod(Math.atan2(by,ay)),mod(Math.atan2(-(ax-ay),bx-by))]){
   if(a>lo&&a<hi)consider(a);
  }
 }
 return {...best,method:'convex-hull-support-events',supportIntervals:knots.length-1,candidates};
}
