/** Resolve the detected socket rim against an exact CAD plane. This changes only
 * the rigid edit coordinate frame; original-pose exports invert the same frame. */
export function refineSocketPlacement(source,detection,bottom){
 const R=detection.rotation,t=detection.translation;
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const oldZ=R.slice(6,9),oldX=R.slice(0,3);
 // Axis-aligned inputs have no tessellation-normal rotation to refine.
 if(oldZ.some(n=>Math.abs(n)>1-1e-12))return {detection,refined:false};
 const faces=source.faces;let plane;
 try{for(const face of faces){
  if(face.geomType!=='PLANE')continue;
  const normal=face.normalAt(),center=face.center;
  try{
   let n=normal.toTuple(),p=center.toTuple();if(dot(n,oldZ)<0)n=n.map(v=>-v);
   if(dot(n,oldZ)<1-1e-10||Math.abs(dot(oldZ,p)+t[2]-bottom)>.01)continue;
   plane={n:unit(n),p};break;
  }finally{normal.delete();center.delete();}
 }}finally{faces.forEach(f=>f.delete());}
 if(!plane)return {detection,refined:false};
 const z=plane.n,x=unit(oldX.map((v,i)=>v-dot(oldX,z)*z[i])),y=cross(z,x),rotation=[...x,...y,...z];
 const translation=[dot(oldX,plane.p)+t[0]-dot(x,plane.p),dot(R.slice(3,6),plane.p)+t[1]-dot(y,plane.p),bottom-dot(z,plane.p)];
 return {detection:{...detection,rotation,translation},refined:true,normalAdjustment:Math.hypot(...z.map((v,i)=>v-oldZ[i])),rimOffsetMM:dot(oldZ,plane.p)+t[2]-bottom};
}
