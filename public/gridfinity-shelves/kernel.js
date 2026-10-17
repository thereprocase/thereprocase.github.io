/** Parametric shelf mesh kernel. Coordinates match the native FreeCAD generator. */
export const defaults = {columns:2, rows:1, clearance:0, web:2.4, beam:10, angle:0, mount_rows:2, backplate:true};
export function parameters(input) {
 const p={...defaults,...input};
 for(const k of Object.keys(input)) if(!(k in defaults)) throw Error(`Unknown parameter: ${k}`);
 for(const k of ['columns','rows']) if(!Number.isInteger(p[k])||p[k]<1||p[k]>12) throw Error(`${k}: use a whole number from 1 to 12`);
 if(p.columns*p.rows>64) throw Error('Use at most 64 cells per shelf.');
 for(const [k,lo,hi] of [['clearance',-.1,.2],['web',2.4,6],['beam',5,20],['angle',-30,5]]) if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi) throw Error(`${k}: use ${lo} to ${hi} ${k==='angle'?'degrees':'mm'}`);
 if(!Number.isInteger(p.mount_rows)||p.mount_rows<1||p.mount_rows>4)throw Error('Mount height: use one to four peg rows.');
 if(typeof p.backplate!=='boolean')throw Error('Backplate must be true or false.');
 const mountZ=Array.from({length:p.mount_rows},(_,i)=>-25.4*i),backBottom=p.mount_rows===1?-12.7:mountZ.at(-1)-4.28,webColumns=Array.from({length:p.columns+1},(_,i)=>(i-p.columns/2)*42);
 const lanes=Math.ceil((42*p.columns+6)/25.4),frameWidth=42*p.columns+4,available=Array.from({length:lanes},(_,i)=>i).filter(i=>Math.abs((i-(lanes-1)/2)*25.4)+5<=frameWidth/2+1e-8),holes=available.filter((_,i)=>i%3===0);
 if(holes.at(-1)!==available.at(-1))holes.push(available.at(-1));
 return {...p,mountZ,backBottom,webColumns,frameWidth,width:lanes*25.4-2,mounts:holes.map(i=>(i-(lanes-1)/2)*25.4),front:51.55+42*(p.rows-1)};
}
function rounded(cx,cy,w,r,z) {
 const a=[];
 for(const [x,y,start] of [[cx+w/2-r,cy-w/2+r,-90],[cx+w/2-r,cy+w/2-r,0],[cx-w/2+r,cy+w/2-r,90],[cx-w/2+r,cy-w/2+r,180]])
  for(let j=0;j<=24;j++){const t=(start+j*90/24)*Math.PI/180;a.push([x+r*Math.cos(t),y+r*Math.sin(t),z]);}
 return a;
}
function framePolygon(width,back,front) {
 const x=width/2,r=5,a=[[-x,back],[x,back],[x,front-r]];
 for(let j=1;j<=24;j++){const t=j*Math.PI/48;a.push([x-r+r*Math.cos(t),front-r+r*Math.sin(t)]);}
 a.push([-x+r,front]);for(let j=1;j<=24;j++){const t=Math.PI/2+j*Math.PI/48;a.push([-x+r+r*Math.cos(t),front-r+r*Math.sin(t)]);}
 return a;
}
export function build(module, inputs, input) {
 const p=parameters(input), {Manifold:M,Mesh}=module, allocated=[];
 const keep=o=>{allocated.push(o);return o;};
 const moved=(o,v)=>keep(o.translate(v));
 const box=(size,pos)=>moved(keep(M.cube(size)),pos);
 function mesh(vertices,triangles) {return keep(new M(new Mesh({numProp:3,vertProperties:new Float32Array(vertices.flat()),triVerts:new Uint32Array(triangles.flat())})));}
 function loft(x,y,sections) {
  const rings=sections.map(([z,w,r])=>rounded(x,y,w,r,z)),v=rings.flat(),n=rings[0].length,t=[];
  const bottom=v.length;v.push([x,y,sections[0][0]]); const top=v.length;v.push([x,y,sections.at(-1)[0]]);
  for(let i=0;i<n;i++){const j=(i+1)%n;t.push([bottom,j,i],[top,(rings.length-1)*n+i,(rings.length-1)*n+j]);}
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){const j=(i+1)%n,a=k*n+i,b=k*n+j,c=(k+1)*n+j,d=(k+1)*n+i;t.push([a,b,c],[a,c,d]);}
  return mesh(v,t);
 }
 function prism(poly,x0,x1) {
  // Convex YZ polygon; triangle fan and side quads, then orient by signed volume.
  const v=[...poly.map(([y,z])=>[x0,y,z]),...poly.map(([y,z])=>[x1,y,z])],n=poly.length,t=[];
  for(let i=1;i<n-1;i++)t.push([0,i+1,i],[n,n+i,n+i+1]);
  for(let i=0;i<n;i++){const j=(i+1)%n;t.push([i,j,n+j],[i,n+j,n+i]);}
  let vol=0;for(const [i,j,k] of t){const a=v[i],b=v[j],c=v[k];vol+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);}
  if(vol<0)t.forEach(a=>a.reverse());return mesh(v,t);
 }
 try {
  const pieces=[],pockets=[],pegs=[],feet=[],c=p.clearance,angle=p.angle*Math.PI/180,tangent=Math.tan(angle);
  const ys=inputs.upper.vertices.map(v=>v[1]),zs=inputs.upper.vertices.map(v=>v[2]);
  const hinge=Math.max(5.72,3.48-tangent*5.4+.25,Math.max(...zs)-tangent*((tangent>=0?Math.min(...ys):Math.max(...ys))-.15)+.275);
  const tilt=o=>moved(keep(moved(o,[0,-.15,-5.72]).rotate([p.angle,0,0])),[0,.15,hinge]);
  const point=(y,z)=>[.15+(y-.15)*Math.cos(angle)-(z-5.72)*Math.sin(angle),hinge+(y-.15)*Math.sin(angle)+(z-5.72)*Math.cos(angle)];
  const frame=(back,z,height)=>tilt(moved(keep(M.extrude([framePolygon(p.frameWidth,back,p.front)],height)),[0,0,z]));
  pieces.push(frame(5.55,.72,5));const frontMask=frame(-1000,-1000,2000);
  for(let j=0;j<p.rows;j++)for(let i=0;i<p.columns;i++){
   const x=(i-(p.columns-1)/2)*42,y=28.55+42*j;
   pockets.push(tilt(loft(x,y,[[-1,36.5,1.25],[1.42,36.5,1.25],[2.12,37.9,1.95],[3.92,37.9,1.95],[6.07,42.2,4.1],[7.6,42.2,4.1]].map(([z,w,r])=>[z,w+2*c,r+c]))));
   pockets.push(tilt(loft(x,y,[[5.52,41.1+2*c,3.55+c],[5.72,41.9+2*c,3.95+c],[6.72,41.9+2*c,3.95+c]])));
   feet.push(tilt(loft(x,y,[[.97,35.6,.8],[1.77,37.2,1.6],[3.57,37.2,1.6],[5.72,41.5,3.75]])));
  }
  pieces.push(box([p.frameWidth,5.4,hinge+1-.72],[-p.frameWidth/2,.15,.72]));
  if(p.columns>1||p.beam>5)pieces.push(keep(tilt(box([42*p.columns,2.4,p.beam],[-21*p.columns,p.front-2.4,5.72-p.beam])).intersect(frontMask)));
  const upper=mesh(inputs.upper.vertices,inputs.upper.triangles),lower=mesh(inputs.lower.vertices,inputs.lower.triangles);
  const locator=p.mount_rows>2?mesh(inputs.locator.vertices,inputs.locator.triangles):null;
  const bottom=p.backBottom;
  if(p.backplate)pieces.push(box([p.frameWidth,5.4,hinge+1-bottom],[-p.frameWidth/2,.15,bottom]));
  else {
   pieces.push(box([p.frameWidth,5.4,4.28],[-p.frameWidth/2,.15,bottom]));
   for(const x of p.mounts)pieces.push(box([10,5.4,hinge+1-bottom],[x-5,.15,bottom]));
   for(const x of p.webColumns)pieces.push(box([p.web,5.4,hinge+1-bottom],[x-p.web/2,.15,bottom]));
  }
  for(const x of p.webColumns)pieces.push(keep(prism([[5,bottom+2.18],point(p.front,5.72-p.beam),point(p.front,4.72),[5,hinge+tangent*4.85-3.12]],x-p.web/2,x+p.web/2).intersect(frontMask)));
  for(const x of p.mounts)for(let i=0;i<p.mount_rows;i++){
   const peg=i===0?upper:i===p.mount_rows-1?lower:locator,copy=moved(peg,[x,0,p.mountZ[i]]);pieces.push(copy);pegs.push(copy);
  }
  let shape=keep(M.union(pieces));
  const extent=p.width/2+20,below=prism([[-60,-1000],[1000,-1000],[1000,hinge+tangent*(1000-.15)],[-60,hinge+tangent*(-60-.15)]],-extent,extent);
  shape=keep(shape.intersect(below));shape=keep(shape.subtract(keep(M.union(pockets))));
  // Match the float32 envelope plane exactly; a double .15 leaves a nanometer cut separating pegs.
  const reach=p.width/2+20,allowed=prism(inputs.envelope.map(([y,z],i,a)=>[y,i===0||i===a.length-1?-200:z]),-reach,reach),forbidden=keep(box([2*reach,60,400],[-reach,Math.fround(.15),-200]).subtract(allowed));
  shape=keep(shape.subtract(forbidden));
  // Remove boolean slivers below float32 export resolution before validation.
  shape=keep(shape.simplify(0.00001));
  if(shape.status()!=='NoError'||shape.volume()<=0)throw Error(`Geometry failed: ${shape.status()}`);
  const parts=shape.decompose();parts.forEach(keep);if(parts.length!==1)throw Error('Generated shelf components: '+JSON.stringify(parts.map(x=>({volume:x.volume(),bounds:x.boundingBox()}))));
  const clip=box([2*reach,60.15,400],[-reach,-60,-200]);
  const expected=keep(keep(M.union(pegs)).intersect(clip)),actual=keep(shape.intersect(clip));
  const pegDelta=keep(expected.subtract(actual)).volume()+keep(actual.subtract(expected)).volume();
  if(pegDelta>.01)throw Error('Connector preservation check failed.');
  for(const x of p.mounts)for(let i=0;i<p.mount_rows;i++){const z=p.mountZ[i]+.12,d=i===0?6.72:7.62;const root=box([d,5.4,d],[x-d/2,.15,z-d/2]);if(keep(root.subtract(shape)).volume()>.01)throw Error('Continuous root-wall check failed.');}
  const coreDepth=Math.min(1.9,2.05-c),core=tilt(box([p.mounts.at(-1)-p.mounts[0],coreDepth,p.beam],[p.mounts[0],p.front-coreDepth,5.72-p.beam]));
  const coreMissing=keep(core.subtract(shape)).volume();
  // At large spans, micron-scale boundary rounding accumulates measurable volume.
  // Bound the skin by the simplify tolerance plus one float32 ULP at these coordinates.
  const coreBounds=core.boundingBox(),coreMagnitude=Math.max(1,...coreBounds.min.map(Math.abs),...coreBounds.max.map(Math.abs));
  const coreTolerance=.00001+2**(Math.floor(Math.log2(coreMagnitude))-23),span=p.mounts.at(-1)-p.mounts[0];
  const insetCore=tilt(box([span-2*coreTolerance,coreDepth-2*coreTolerance,p.beam-2*coreTolerance],[p.mounts[0]+coreTolerance,p.front-coreDepth+coreTolerance,5.72-p.beam+coreTolerance]));
  const coreInteriorMissing=keep(insetCore.subtract(shape)).volume();
  const coreSkinVolume=span*coreDepth*p.beam-(span-2*coreTolerance)*(coreDepth-2*coreTolerance)*(p.beam-2*coreTolerance);
  if(coreInteriorMissing>1e-6||coreMissing>coreSkinVolume+1e-6)throw Error('Front beam continuity check failed: '+coreMissing+' mm3 boundary, '+coreInteriorMissing+' mm3 interior.');
  const overlaps=feet.map(foot=>keep(shape.intersect(foot)).volume()),footOverlap=overlaps.reduce((a,b)=>a+b,0),maxFootOverlap=Math.max(...overlaps);
  if(c>=0&&maxFootOverlap>.002)throw Error('Reference bin-foot clearance check failed.');
  const source=shape.getMesh(),v=source.vertProperties,t=source.triVerts,n=source.numProp;
  const vertices=new Float32Array(v.length/n*3);
  const rotation=Math.PI-angle,cos=Math.cos(rotation),sin=Math.sin(rotation);let minZ=Infinity;
  for(let i=0;i<v.length/n;i++){vertices[3*i]=v[n*i];vertices[3*i+1]=cos*v[n*i+1]-sin*v[n*i+2];vertices[3*i+2]=sin*v[n*i+1]+cos*v[n*i+2];minZ=Math.min(minZ,vertices[3*i+2]);}
  for(let i=2;i<vertices.length;i+=3)vertices[i]-=minZ;
  // Re-enter the kernel at the actual float32 print coordinates. This collapses
  // sub-resolution boolean slivers before emitting STL, rather than asking a slicer to repair it.
  const printMesh=new Mesh({numProp:3,vertProperties:vertices,triVerts:new Uint32Array(t)});
  const final=keep(new M(printMesh));
  if(final.status()!=='NoError'||Math.abs(final.volume()-shape.volume())/shape.volume()>1e-5)throw Error('Float32 export failed: '+final.status()+'; volume '+final.volume()+' vs '+shape.volume());
  const output=final.getMesh(),result={vertices:new Float32Array(output.vertProperties),triangles:new Uint32Array(output.triVerts),parameters:p,volume:final.volume(),printRotation:rotation,printZShift:-minZ,hinge,pegDelta,coreMissing,coreInteriorMissing,coreTolerance,footOverlap,maxFootOverlap,trianglesCount:output.triVerts.length/3};
  validateExport(result);
  return result;
 } finally {for(let i=allocated.length-1;i>=0;i--)allocated[i].delete();}
}
export function validateExport({vertices:v,triangles:t}) {
 const keys=[];for(let i=0;i<v.length;i+=3){if(!Number.isFinite(v[i]+v[i+1]+v[i+2])||v[i+2]<-.00001)throw Error('Invalid export coordinates.');keys.push(`${v[i]},${v[i+1]},${v[i+2]}`);}
 const edges=new Map();for(let i=0;i<t.length;i+=3)for(let j=0;j<3;j++){const a=keys[t[i+j]],b=keys[t[i+(j+1)%3]];if(a===b)throw Error('Collapsed STL edge.');const k=a<b?a+'|'+b:b+'|'+a,old=edges.get(k)||[0,0];edges.set(k,[old[0]+1,old[1]+(a<b?1:-1)]);}
 if([...edges.values()].some(([n,w])=>n!==2||w!==0))throw Error('STL closure or winding check failed.');
}
export function binarySTL(result) {
 const {vertices:v,triangles:t}=result,b=new ArrayBuffer(84+t.length/3*50),d=new DataView(b);
 new Uint8Array(b).set(new TextEncoder().encode('Gridfinity shelf generator v1; millimeters; inverted print pose'));
 d.setUint32(80,t.length/3,true);
 for(let i=0;i<t.length;i+=3){const o=84+i/3*50;for(let j=0;j<3;j++)for(let k=0;k<3;k++)d.setFloat32(o+12+j*12+k*4,v[t[i+j]*3+k],true);}
 return b;
}
