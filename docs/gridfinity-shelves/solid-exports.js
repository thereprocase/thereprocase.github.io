import {footprintHull,placementAtAngle} from './bed-placement.js?v=diagonal-1';
import {validateExport} from './kernel.js?v=base-types-1';
const enc=new TextEncoder();
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const real=x=>{const s=num(x);return /[.e]/i.test(s)?s.replace(/e/i,'E').replace(/^(\-?\d+)E/,'$1.E'):s+'.';};
const num=x=>{if(!Number.isFinite(x))throw Error('Invalid geometry coordinate.');return Object.is(x,-0)?'0':String(x);};
function parts(r){if(r.parts?.length)return r.parts;if(!r.helpers?.length)throw Error('Generate reinforcement bodies first.');return [{name:'Body_PRINT',vertices:r.vertices,triangles:r.triangles},...r.helpers];}

// Join coplanar triangle patches into planar faces. This preserves the boundary
// while avoiding thousands of internal triangle seams in the CAD solid.
function planarFaces(part){
 const v=part.vertices,t=part.triangles,n=t.length/3,parent=Array.from({length:n},(_,i)=>i),normals=[],areas=[],edges=new Map(),vertices=new Map(),canonical=[];
 for(let i=0;i<v.length;i+=3){const key=`${v[i]},${v[i+1]},${v[i+2]}`;if(!vertices.has(key))vertices.set(key,i/3);canonical.push(vertices.get(key));}
 const ids=Array.from(t,x=>canonical[x]),point=i=>[v[3*i],v[3*i+1],v[3*i+2]],find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<n;i++){
  const a=point(ids[3*i]),b=point(ids[3*i+1]),c=point(ids[3*i+2]),ab=b.map((x,k)=>x-a[k]),ac=c.map((x,k)=>x-a[k]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...cross);if(!len)throw Error('Degenerate CAD face.');areas.push(len);normals.push(cross.map(x=>x/len));
  for(let j=0;j<3;j++){const x=ids[3*i+j],y=ids[3*i+(j+1)%3],key=x<y?x+','+y:y+','+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({i,x,y});}
 }
 for(const pair of edges.values())if(pair.length===2){const a=pair[0].i,b=pair[1].i,na=normals[a],nb=normals[b];if(na.reduce((s,x,k)=>s+x*nb[k],0)<1-1e-12)continue;const pa=point(ids[3*a]),pb=point(ids[3*b]);if(Math.abs(na.reduce((s,x,k)=>s+x*(pb[k]-pa[k]),0))>1e-8)continue;parent[find(b)]=find(a);}
 const groups=new Map();for(let i=0;i<n;i++){const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}const result=[];
 for(const [root,triangles] of groups){
  const ref=triangles.reduce((a,b)=>areas[a]>areas[b]?a:b),normal=normals[ref],origin=point(ids[3*ref]);
  const fallback=()=>{for(const i of triangles)result.push({loops:[ids.slice(3*i,3*i+3)],ref:ids.slice(3*i,3*i+3)});};
  if(triangles.some(i=>ids.slice(3*i,3*i+3).some(j=>Math.abs(point(j).reduce((s,x,k)=>s+normal[k]*(x-origin[k]),0))>1e-8))){fallback();continue;}
  const next=new Map();let valid=true,count=0;
  for(const i of triangles)for(let j=0;j<3;j++){const x=ids[3*i+j],y=ids[3*i+(j+1)%3],pair=edges.get(x<y?x+','+y:y+','+x);if(pair.length===2&&find(pair[0].i)===root&&find(pair[1].i)===root)continue;if(next.has(x)){valid=false;break;}next.set(x,y);count++;}
  if(!valid){fallback();continue;}const loops=[];
  while(next.size&&valid){const start=next.keys().next().value,loop=[];let at=start;do{loop.push(at);const to=next.get(at);if(to===undefined||loop.length>count){valid=false;break;}next.delete(at);at=to;}while(at!==start);if(loop.length<3)valid=false;loops.push(loop);}
  const signed=loop=>loop.reduce((sum,a,i)=>{const b=loop[(i+1)%loop.length],p=point(a),q=point(b);return sum+normal[0]*(p[1]*q[2]-p[2]*q[1])+normal[1]*(p[2]*q[0]-p[0]*q[2])+normal[2]*(p[0]*q[1]-p[1]*q[0]);},0);
  const outside=loops.filter(l=>signed(l)>0),inside=loops.filter(l=>signed(l)<0);if(!valid||outside.length!==1||outside.length+inside.length!==loops.length){fallback();continue;}
  result.push({loops:[outside[0],...inside],ref:ids.slice(3*ref,3*ref+3)});
 }
 return result;
}

/** AP214 faceted solids, in millimetres; each named body remains separate. */
export function facetedSTEP(r,module){
 r.stepNormalization=[];
 function hasDegenerate(part){const v=part.vertices,t=part.triangles;for(let i=0;i<t.length;i+=3){const a=3*t[i],b=3*t[i+1],c=3*t[i+2],ab=[0,1,2].map(k=>v[b+k]-v[a+k]),ac=[0,1,2].map(k=>v[c+k]-v[a+k]);if(!Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]))return true;}return false;}
 function cadPart(part){
  if(!module)throw Error('CAD normalization requires the solid kernel.');
  if(r.parameters?.base_type==='weighted'&&!hasDegenerate(part)){
   validateExport(part);
   r.stepNormalization.push({name:part.name,toleranceMM:0,symmetricDifferenceMM3:0,sourceVolume:part.volume??r.volume,cadVolume:part.volume??r.volume});
   return part;
  }
  const {Manifold:M,Mesh}=module,source=new M(new Mesh({numProp:3,vertProperties:part.vertices,triVerts:part.triangles}));
  try{
   const bb=source.boundingBox(),size=Math.max(1,...bb.min.map(Math.abs),...bb.max.map(Math.abs)),precision=.00001+2**(Math.floor(Math.log2(size))-22),standard=Math.max(.001,precision);
   // Weighted floors add small curved features. If the usual simplification
   // exceeds the material-change limit, retry at finer precision, keeping the
   // same topology, face and volume guards. Existing frame exports are unchanged.
   const tolerances=r.parameters?.base_type==='weighted'?[standard,Math.max(.0001,precision),precision]:[standard];
   let lastError;
   for(const tolerance of [...new Set(tolerances)]){
    const clean=source.simplify(tolerance);
    try{
     const a=source.subtract(clean),b=clean.subtract(source),difference=a.volume()+b.volume();a.delete();b.delete();
     if(difference>source.volume()*1e-4)throw Error('STEP normalization changed too much material.');
     const mesh=clean.getMesh(),result={...part,vertices:new Float32Array(mesh.vertProperties),triangles:new Uint32Array(mesh.triVerts)};
     validateExport(result);if(hasDegenerate(result))throw Error('STEP contains a degenerate planar face.');
     r.stepNormalization.push({name:part.name,toleranceMM:tolerance,symmetricDifferenceMM3:difference,sourceVolume:source.volume(),cadVolume:clean.volume()});return result;
    }catch(e){lastError=e;}finally{clean.delete();}
   }
   throw Error(`${part.name}: ${lastError.message}`);
  }finally{source.delete();}
 }


 const lines=[],add=s=>(lines.push(`#${lines.length+1}=${s};`),`#${lines.length}`),ctx=add("APPLICATION_CONTEXT('core data for automotive mechanical design processes')");
 add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${ctx})`);
 const length=add('(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))'),angle=add('(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))'),solidAngle=add('(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())');
 const uncertainty=add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.001),${length},'distance_accuracy_value','')`);
 const geom=add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${length},${angle},${solidAngle})) REPRESENTATION_CONTEXT('',''))`);
 for(const raw of parts(r)){
  const part=cadPart(raw);
  const name=part.name.replaceAll("'","''"),v=part.vertices,t=part.triangles,points=[];
  for(let i=0;i<v.length;i+=3)points.push(add(`CARTESIAN_POINT('',(${real(v[i])},${real(v[i+1])},${real(v[i+2])}))`));
  const faces=[];for(const face of planarFaces(part)){const bounds=face.loops.map((vertices,i)=>{const loop=add(`POLY_LOOP('',(${vertices.map(j=>points[j]).join(',')}))`);return add(`${i?'FACE_BOUND':'FACE_OUTER_BOUND'}('',${loop},.T.)`);}),ia=3*face.ref[0],ib=3*face.ref[1],ic=3*face.ref[2],ab=[0,1,2].map(k=>v[ib+k]-v[ia+k]),ac=[0,1,2].map(k=>v[ic+k]-v[ia+k]),normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...normal);
   if(!len)throw Error('Degenerate STEP face.');
   const nz=add(`DIRECTION('',(${normal.map(x=>real(x/len)).join(',')}))`),nx=add(`DIRECTION('',(${ab.map(real).join(',')}))`),axis=add(`AXIS2_PLACEMENT_3D('',${points[face.ref[0]]},${nz},${nx})`),plane=add(`PLANE('',${axis})`);faces.push(add(`FACE_SURFACE('',(${bounds.join(',')}),${plane},.T.)`));}
  const shell=add(`CLOSED_SHELL('',(${faces.join(',')}))`),brep=add(`FACETED_BREP('${name}',${shell})`),rep=add(`FACETED_BREP_SHAPE_REPRESENTATION('${name}',(${brep}),${geom})`);
  const pc=add(`PRODUCT_CONTEXT('',${ctx},'mechanical')`),product=add(`PRODUCT('${name}','${name}','',(${pc}))`),formation=add(`PRODUCT_DEFINITION_FORMATION('','',${product})`),dc=add(`PRODUCT_DEFINITION_CONTEXT('part definition',${ctx},'design')`),definition=add(`PRODUCT_DEFINITION('design','',${formation},${dc})`),shape=add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);add(`SHAPE_DEFINITION_REPRESENTATION(${shape},${rep})`);
 }
 return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('${r.parts?'Faceted Gridfinity drawer tile':'Faceted Gridfinity body and separate 100 percent infill helpers; margin 3.5 mm'}'),'2;1');\nFILE_NAME('gridfinity.step','${new Date().toISOString().slice(0,19)}',('thereprocase'),(''),'Gridfinity browser generator','Gridfinity','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}

const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function zip(files){
 const local=[],central=[];let offset=0;
 for(const [path,text] of files){const name=enc.encode(path),data=enc.encode(text),crc=crc32(data),a=new Uint8Array(30+name.length),v=new DataView(a.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);a.set(name,30);local.push(a,data);
  const b=new Uint8Array(46+name.length),w=new DataView(b.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);b.set(name,46);central.push(b);offset+=a.length+data.length;
 }
 const size=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);const result=new Uint8Array(offset+size+22);let i=0;for(const b of [...local,...central,end]){result.set(b,i);i+=b.length;}return result;
}

/** One model object, normal body plus parameter-modifier volumes. No printer settings. */
export function modifier3MF(r,bed){
 let placement='';
 if(bed){if(!Number.isFinite(bed.width)||!Number.isFinite(bed.depth)||bed.width<25||bed.depth<25||bed.width>2000||bed.depth>2000)throw Error('Invalid bed dimensions.');const p=placementAtAngle(footprintHull(r.vertices),bed.width,bed.depth,bed.rotationDeg??0);placement=` transform="${num(p.c)} ${num(p.s)} 0 ${num(-p.s)} ${num(p.c)} 0 0 0 1 ${num(p.x)} ${num(p.y)} 0"`;}

 const all=parts(r),parent=all.length+1,resources=all.map((part,i)=>{
  const v=part.vertices,t=part.triangles,vs=[],ts=[];for(let j=0;j<v.length;j+=3)vs.push(`<vertex x="${num(v[j])}" y="${num(v[j+1])}" z="${num(v[j+2])}"/>`);for(let j=0;j<t.length;j+=3)ts.push(`<triangle v1="${t[j]}" v2="${t[j+1]}" v3="${t[j+2]}"/>`);
  return `<object id="${i+1}" type="model" name="${xml(part.name)}"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>`;
 }).join('');
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">OrcaSlicer-2.5.0</metadata><metadata name="Generator">Gridfinity browser generator · Orca-compatible modifier package</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><resources>${resources}<object id="${parent}" type="model"><components>${all.map((_,i)=>`<component objectid="${i+1}"/>`).join('')}</components></object></resources><build><item objectid="${parent}"${placement}/></build></model>`;
 const config=`<?xml version="1.0" encoding="UTF-8"?><config><object id="${parent}"><metadata key="name" value="Gridfinity ${xml(r.parameters.board_system)} ${r.kind==='coupon'?'coupon':'shelf'}"/>${all.map((part,i)=>`<part id="${i+1}" subtype="${i?'modifier_part':'normal_part'}"><metadata key="name" value="${xml(part.name)}"/>${i?'<metadata key="sparse_infill_density" value="100%"/>':''}</part>`).join('')}</object></config>`;
 return zip([
  ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/></Types>'],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'],
  ['3D/3dmodel.model',model],['Metadata/model_settings.config',config],['Metadata/gridfinity.json',JSON.stringify({revision:'dense-1',previewBedMM:bed??null,parameters:Object.fromEntries(Object.entries(r.parameters).filter(([k])=>!['mountSites','mounts','mountZ','webColumns'].includes(k))),marginMM:3.5,helpers:'100% infill parameter modifiers; not extra printable parts'})]
 ]);
}
