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
export function bestPlacement(hull,width,depth){
 let best=placementAtAngle(hull,width,depth,0);
 const consider=angle=>{const p=placementAtAngle(hull,width,depth,angle);if(p.score<best.score-1e-10)best=p;};
 for(let i=1;i<=900;i++)consider(i/10);
 const coarse=best.angle;for(let i=-10;i<=10;i++){const a=coarse+i/100;if(a>=0&&a<=90)consider(a);}
 return best;
}
