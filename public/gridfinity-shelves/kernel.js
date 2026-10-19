import {boards,boardSettings,boardDefaults,checkBoard,boardLayout,makeBoardPegs} from './boards.js?v=boards-3';
import {pegFitDefaults,checkPegFit,makePegs} from './peg-fit.js?v=fit-7';
/** Parametric shelf mesh kernel. Coordinates match the native FreeCAD generator. */
export const defaults = {columns:2, rows:1, clearance:0, web:2.4, beam:10, angle:0, mount_rows:2, backplate:true,...pegFitDefaults,...boardDefaults};
export function parameters(input) {
 const p={...defaults,...boardSettings(input.board_system??'original'),...input};if(p.board_system==='original')checkPegFit(p);else for(const k of Object.keys(pegFitDefaults))p[k]=pegFitDefaults[k];checkBoard(p);
 for(const k of Object.keys(input)) if(!(k in defaults)) throw Error(`Unknown parameter: ${k}`);
 for(const k of ['columns','rows']) if(!Number.isInteger(p[k])||p[k]<1||p[k]>12) throw Error(`${k}: use a whole number from 1 to 12`);
 if(p.columns*p.rows>64) throw Error('Use at most 64 cells per shelf.');
 for(const [k,lo,hi] of [['clearance',-.1,.2],['web',2.4,6],['beam',5,20],['angle',-30,5]]) if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi) throw Error(`${k}: use ${lo} to ${hi} ${k==='angle'?'degrees':'mm'}`);
 if(!Number.isInteger(p.mount_rows)||p.mount_rows<1||p.mount_rows>4)throw Error('Mount height: use one to four peg rows.');
 if(typeof p.backplate!=='boolean')throw Error('Backplate must be true or false.');
 const mountZ=Array.from({length:p.mount_rows},(_,i)=>-25.4*i),backBottom=p.mount_rows===1?-12.7:mountZ.at(-1)-4.28,webColumns=Array.from({length:p.columns+1},(_,i)=>(i-p.columns/2)*42);
 const lanes=Math.ceil((42*p.columns+6)/25.4),frameWidth=42*p.columns+4,available=Array.from({length:lanes},(_,i)=>i).filter(i=>Math.abs((i-(lanes-1)/2)*25.4)+5<=frameWidth/2+1e-8),holes=available.filter((_,i)=>i%3===0);
 if(holes.at(-1)!==available.at(-1))holes.push(available.at(-1));
 const original={...p,mountZ,backBottom,webColumns,frameWidth,width:lanes*25.4-2,mounts:holes.map(i=>(i-(lanes-1)/2)*25.4),front:51.55+42*(p.rows-1)};const layout=boardLayout(p);return {...original,...layout,mountSites:layout?.mountSites??original.mounts.flatMap(x=>mountZ.map((z,row)=>({x,z,row})))};
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
  const pieces=[],pockets=[],pegs=[],feet=[],mountCuts=[],c=p.clearance,angle=p.angle*Math.PI/180,tangent=Math.tan(angle);
  const pegSet=p.board_system==='original'?makePegs(module,inputs,p,keep):makeBoardPegs(module,p,keep),upperMesh=pegSet.upper.getMesh(),ys=[],zs=[];if(p.board_system==='original'&&p.peg_clearance===0&&p.hook_grip===0){for(const v of inputs.upper.vertices){ys.push(v[1]);zs.push(v[2]);}}else for(let i=0;i<upperMesh.vertProperties.length;i+=3){ys.push(upperMesh.vertProperties[i+1]);zs.push(upperMesh.vertProperties[i+2]);}
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
  const {upper,lower,locator}=pegSet;
  const bottom=p.backBottom;
  if(p.backplate)pieces.push(box([p.frameWidth,5.4,hinge+1-bottom],[-p.frameWidth/2,.15,bottom]));
  else {
   pieces.push(box([p.frameWidth,5.4,4.28],[-p.frameWidth/2,.15,bottom]));
   for(const x of p.mounts)pieces.push(box([10,5.4,hinge+1-bottom],[x-5,.15,bottom]));
   for(const x of p.webColumns)pieces.push(box([p.web,5.4,hinge+1-bottom],[x-p.web/2,.15,bottom]));
  }
  // Screw mounts need a continuous gusset strip beneath the lower counterbore.
  for(const x of p.webColumns)pieces.push(keep(prism([[5,bottom+(pegSet.mode==='bolted'?0:2.18)],point(p.front,5.72-p.beam),point(p.front,4.72),[5,hinge+tangent*4.85-3.12]],x-p.web/2,x+p.web/2).intersect(frontMask)));
  for(const {x,z,row:i} of p.mountSites){
   const peg=i===0?upper:i===p.mount_rows-1?lower:locator,copy=moved(peg,[x,0,z]);pieces.push(copy);pegs.push(copy);if(pegSet.cuts)mountCuts.push(...pegSet.cuts(x,z));
  }
  let shape=keep(M.union(pieces));if(mountCuts.length)shape=keep(shape.subtract(keep(M.union(mountCuts))));
  const extent=p.width/2+20,below=prism([[-60,-1000],[1000,-1000],[1000,hinge+tangent*(1000-.15)],[-60,hinge+tangent*(-60-.15)]],-extent,extent);
  shape=keep(shape.intersect(below));shape=keep(shape.subtract(keep(M.union(pockets))));
  // Match the float32 envelope plane exactly; a double .15 leaves a nanometer cut separating pegs.
  const reach=p.width/2+20,allowed=prism(inputs.envelope.map(([y,z],i,a)=>[y,i===0||i===a.length-1?-200:z]),-reach,reach),forbidden=keep(box([2*reach,60,400],[-reach,Math.fround(.15),-200]).subtract(allowed));
  if(p.board_system==='original')shape=keep(shape.subtract(forbidden));
  // Remove boolean slivers below float32 export resolution before validation.
  shape=keep(shape.simplify(0.00001));
  if(shape.status()!=='NoError'||shape.volume()<=0)throw Error(`Geometry failed: ${shape.status()}`);
  const parts=shape.decompose();parts.forEach(keep);if(parts.length!==1)throw Error('Generated shelf components: '+JSON.stringify(parts.map(x=>({volume:x.volume(),bounds:x.boundingBox()}))));
  const clip=box([2*reach,60.15,400],[-reach,-60,-200]);
  const expected=keep(keep(M.union(pegs)).intersect(clip)),actual=keep(shape.intersect(clip));
  const pegDelta=keep(expected.subtract(actual)).volume()+keep(actual.subtract(expected)).volume();
  if(pegDelta>.01)throw Error('Connector preservation check failed.');
  for(const {x,z,row:i} of p.mountSites){const d=i===0?6.72:7.62;const root=p.board_system==='original'?box([d,5.4,d],[x-d/2,.15,z+.12-d/2]):box([pegSet.root.width,5.4,pegSet.root.height],[x-pegSet.root.width/2,.15,z+pegSet.root.bottom]);const rootMaterial=mountCuts.length?keep(root.subtract(keep(M.union(mountCuts)))):root;if(keep(rootMaterial.subtract(shape)).volume()>.01)throw Error('Continuous root-wall check failed.');}
  const coreDepth=Math.min(1.9,2.05-c),core=tilt(box([p.mounts.at(-1)-p.mounts[0],coreDepth,p.beam],[p.mounts[0],p.front-coreDepth,5.72-p.beam]));
  const coreMissing=keep(core.subtract(shape)).volume();
  // At large spans, micron-scale boundary rounding accumulates measurable volume.
  // Bound the skin by the simplify tolerance plus one float32 ULP at these coordinates.
  const coreBounds=core.boundingBox(),coreMagnitude=Math.max(1,...coreBounds.min.map(Math.abs),...coreBounds.max.map(Math.abs));
  const coreTolerance=.00001+2**(Math.floor(Math.log2(coreMagnitude))-23),span=p.mounts.at(-1)-p.mounts[0];
  const insetCore=span>2*coreTolerance?tilt(box([span-2*coreTolerance,coreDepth-2*coreTolerance,p.beam-2*coreTolerance],[p.mounts[0]+coreTolerance,p.front-coreDepth+coreTolerance,5.72-p.beam+coreTolerance])):null;
  const coreInteriorMissing=insetCore?keep(insetCore.subtract(shape)).volume():0;
  const coreSkinVolume=Math.max(0,span*coreDepth*p.beam-(span-2*coreTolerance)*(coreDepth-2*coreTolerance)*(p.beam-2*coreTolerance));
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
  validateFloatExport(final,result,keep,p.board_system!=='original');
  return result;
 } finally {for(let i=allocated.length-1;i>=0;i--)allocated[i].delete();}
}
// Large float32 coordinates can flatten a micron-scale fan into collinear
// triangles. Normalize that fan in the solid kernel, then retain the same strict
// edge check. Original exports are untouched; no slicer repair is involved.
function validateFloatExport(solid,result,keep,enabled){
 try{validateExport(result);return;}catch(error){if(!enabled||!['STL closure or winding check failed.','Collapsed STL edge.'].includes(error.message))throw error;}
 const bounds=solid.boundingBox(),magnitude=Math.max(1,...bounds.min.map(Math.abs),...bounds.max.map(Math.abs)),tolerance=.00001+2*2**(Math.floor(Math.log2(magnitude))-23),clean=keep(solid.simplify(tolerance));
 if(clean.status()!=='NoError')throw Error('Float export normalization failed.');
 const difference=keep(solid.subtract(clean)).volume()+keep(clean.subtract(solid)).volume();
 if(difference>1e-5*solid.volume())throw Error('Float export normalization changed too much material.');
 const parts=clean.decompose();parts.forEach(keep);if(parts.length!==1)throw Error('Float export normalization split the part.');
 const mesh=clean.getMesh();result.vertices=new Float32Array(mesh.vertProperties);result.triangles=new Uint32Array(mesh.triVerts);result.trianglesCount=mesh.triVerts.length/3;result.volume=clean.volume();result.exportNormalization={tolerance,symmetricDifferenceMM3:difference};validateExport(result);
}
export function validateExport({vertices:v,triangles:t}) {
 const keys=[];for(let i=0;i<v.length;i+=3){if(!Number.isFinite(v[i]+v[i+1]+v[i+2])||v[i+2]<-.00001)throw Error('Invalid export coordinates.');keys.push(`${v[i]},${v[i+1]},${v[i+2]}`);}
 const edges=new Map();for(let i=0;i<t.length;i+=3)for(let j=0;j<3;j++){const a=keys[t[i+j]],b=keys[t[i+(j+1)%3]];if(a===b)throw Error('Collapsed STL edge.');const k=a<b?a+'|'+b:b+'|'+a,old=edges.get(k)||[0,0];edges.set(k,[old[0]+1,old[1]+(a<b?1:-1)]);}
 if([...edges.values()].some(([n,w])=>n!==2||w!==0))throw Error('STL closure or winding check failed.');
}
export function binarySTL(result) {
 const {vertices:v,triangles:t}=result,b=new ArrayBuffer(84+t.length/3*50),d=new DataView(b);
 new Uint8Array(b).set(new TextEncoder().encode(result.parameters?.board_system&&result.parameters.board_system!=='original'?`Gridfinity ${result.parameters.board_system}; NOT PRINT TESTED; mm; frame-down`:'Gridfinity shelf generator v1; millimeters; inverted print pose'));
 d.setUint32(80,t.length/3,true);
 for(let i=0;i<t.length;i+=3){const o=84+i/3*50;for(let j=0;j<3;j++)for(let k=0;k<3;k++)d.setFloat32(o+12+j*12+k*4,v[t[i+j]*3+k],true);}
 return b;
}

/** Small paired connector coupon, printed with its top face on the bed. */
export function buildCoupon(module,inputs,input={}){
 const p=parameters(input);if(p.board_system!=='original')return boardCoupon(module,p);const {Manifold:M,Mesh}=module,allocated=[],keep=o=>(allocated.push(o),o);
 try{
  const pegs=makePegs(module,inputs,p,keep),lower=keep(pegs.lower.translate([0,0,-25.4]));
  const plate=keep(keep(M.cube([20,5.4,35.28])).translate([-10,Math.fround(.15),-29.56]));
  const shape=keep(keep(M.union([plate,pegs.upper,lower])).simplify(.00001));
  const components=shape.decompose();components.forEach(keep);if(shape.status()!=='NoError'||components.length!==1)throw Error('Coupon must be one connected solid.');
  const region=keep(keep(M.cube([40,60.15,100])).translate([-20,-60,-50]));
  const expected=keep(keep(M.union([pegs.upper,lower])).intersect(region)),actual=keep(shape.intersect(region));
  const pegDelta=keep(expected.subtract(actual)).volume()+keep(actual.subtract(expected)).volume();if(pegDelta>.01)throw Error('Coupon peg fit changed at the backplate.');
  const source=shape.getMesh(),v=source.vertProperties,vertices=new Float32Array(v.length);let minZ=Infinity;
  for(let i=0;i<v.length;i+=3){vertices[i]=v[i];vertices[i+1]=-v[i+1];vertices[i+2]=-v[i+2];minZ=Math.min(minZ,vertices[i+2]);}
  for(let i=2;i<vertices.length;i+=3)vertices[i]-=minZ;
  const final=keep(new M(new Mesh({numProp:3,vertProperties:vertices,triVerts:new Uint32Array(source.triVerts)})));
  if(final.status()!=='NoError')throw Error('Coupon export failed.');const mesh=final.getMesh();
  const result={kind:'coupon',vertices:new Float32Array(mesh.vertProperties),triangles:new Uint32Array(mesh.triVerts),parameters:{...p,columns:1,rows:1,mount_rows:2,mounts:[0],webColumns:[],angle:0,backplate:true},volume:final.volume(),printRotation:Math.PI,printZShift:-minZ,pegDelta,trianglesCount:mesh.triVerts.length/3};
  validateFloatExport(final,result,keep,p.board_system!=='original');return result;
 }finally{for(let i=allocated.length-1;i>=0;i--)allocated[i].delete();}
}

function boardCoupon(module,input){
 const p=parameters({...Object.fromEntries(Object.keys(defaults).map(k=>[k,input[k]])),columns:2,rows:1,mount_rows:2,angle:0,backplate:true}),{Manifold:M,Mesh}=module,allocated=[],keep=o=>(allocated.push(o),o);
 try{
  const set=makeBoardPegs(module,p,keep),sites=p.board_system==='skadis'?[{x:-10,z:0,row:0},{x:10,z:-20,row:1}]:[{x:0,z:0,row:0},{x:0,z:-boards[p.board_system].pitchZ,row:1}],bottom=sites[1].z+set.root.bottom;
  const plate=keep(keep(M.cube([30,5.4,Math.max(5.72,set.upper.boundingBox().max[2]+.3)-bottom])).translate([-15,Math.fround(.15),bottom]));
  const pegs=sites.map(({x,z,row})=>keep((row?set.lower:set.upper).translate([x,0,z])));let shape=keep(M.union([plate,...pegs]));if(set.cuts)shape=keep(shape.subtract(keep(M.union(sites.flatMap(({x,z})=>set.cuts(x,z))))));shape=keep(shape.simplify(.00001));
  const components=shape.decompose();components.forEach(keep);if(components.length!==1||shape.status()!=='NoError')throw Error('Coupon must be one connected solid.');
  const clip=keep(keep(M.cube([60,60.15,120])).translate([-30,-60,-70])),expected=keep(keep(M.union(pegs)).intersect(clip)),actual=keep(shape.intersect(clip)),pegDelta=keep(expected.subtract(actual)).volume()+keep(actual.subtract(expected)).volume();if(pegDelta>.01)throw Error('Coupon connector changed at the backplate.');
  const source=shape.getMesh(),v=source.vertProperties,vertices=new Float32Array(v.length);let minZ=Infinity;
  for(let i=0;i<v.length;i+=3){vertices[i]=v[i];vertices[i+1]=-v[i+1];vertices[i+2]=-v[i+2];minZ=Math.min(minZ,vertices[i+2]);}
  for(let i=2;i<vertices.length;i+=3)vertices[i]-=minZ;
  const final=keep(new M(new Mesh({numProp:3,vertProperties:vertices,triVerts:new Uint32Array(source.triVerts)})));if(final.status()!=='NoError')throw Error('Coupon export failed.');const mesh=final.getMesh();
  const result={kind:'coupon',vertices:new Float32Array(mesh.vertProperties),triangles:new Uint32Array(mesh.triVerts),parameters:{...p,mountSites:sites,mounts:p.board_system==='skadis'?[-10,10]:[0],mountZ:sites.map(s=>s.z),webColumns:[]},volume:final.volume(),printRotation:Math.PI,printZShift:-minZ,pegDelta,trianglesCount:mesh.triVerts.length/3};validateFloatExport(final,result,keep,p.board_system!=='original');return result;
 }finally{for(let i=allocated.length-1;i>=0;i--)allocated[i].delete();}
}
