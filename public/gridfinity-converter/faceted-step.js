import {ShapeUtils, Vector2} from '../p1s-feet/vendor/three.module.js';

// Exact polygon import, not a tessellation of analytic CAD. Unsupported STEP
// constructs go to the native reader rather than silently dropping geometry.
export function isDirectFacetedSTEP(text) {
  const units=[...text.matchAll(/SI_UNIT\(\s*([^,]+),\s*\.METRE\.\s*\)/g)];
  if(!units.length || units.some(m=>m[1].trim()!=='.MILLI.'))return false;
  return /\bFACETED_BREP\s*\(/.test(text) &&
    !/\b(?:ADVANCED_FACE|MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|MAPPED_ITEM|REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION|CARTESIAN_TRANSFORMATION_OPERATOR\w*|CONVERSION_BASED_UNIT)\s*\(/.test(text) &&
    /LENGTH_UNIT\(\)\s+NAMED_UNIT\(\*\)\s+SI_UNIT\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(text);
}
export function parseFacetedSTEP(text, progress=()=>{}) {
  if (!isDirectFacetedSTEP(text)) throw Error('This faceted STEP needs the native CAD reader for its units or assembly transforms.');
  const records=new Map();
  // Quoted strings (including escaped quotes and semicolons) are one token.
  for (const m of text.matchAll(/#(\d+)\s*=\s*((?:'(?:[^']|'')*'|[^;'])+);/g)) {
    const entity=/^([A-Z_0-9]+)\s*\(([\s\S]*)\)$/.exec(m[2].trim());
    if(entity) records.set(Number(m[1]),{type:entity[1],args:entity[2]});
  }
  const refs=s=>Array.from(s.replace(/'(?:[^']|'')*'/g,"''").matchAll(/#(\d+)/g),m=>Number(m[1]));
  const get=(id,type)=>{const e=records.get(id);if(!e || (type && e.type!==type))throw Error(`Unsupported or missing faceted STEP entity #${id} (${type||'face'}).`);return e;};
  const vector=(id,type)=>{const e=get(id,type),m=/\(([^()]*)\)\s*$/.exec(e.args),v=m?.[1].split(',').map(Number);if(v?.length!==3||!v.every(Number.isFinite))throw Error('Invalid STEP coordinate.');return v;};
  const bodies=[];
  const breps=[...records.values()].filter(e=>e.type==='FACETED_BREP');
  if(!breps.length || breps.length>64)throw Error('Choose a STEP with 1 to 64 closed faceted bodies.');
  for(const brep of breps){
    const name=/^\s*'((?:[^']|'')*)'/.exec(brep.args)?.[1].replaceAll("''", "'")||`Part ${bodies.length+1}`;
    const faces=refs(get(refs(brep.args)[0],'CLOSED_SHELL').args),vertices=[],triangles=[],pointIDs=new Map();
    const index=id=>{if(!pointIDs.has(id)){pointIDs.set(id,vertices.length/3);vertices.push(...vector(id,'CARTESIAN_POINT'));}return pointIDs.get(id);};
    let completed=0;
    for(const id of faces){
      const face=get(id),fr=refs(face.args);
      if(!['FACE_SURFACE','FACE'].includes(face.type))throw Error(`Unsupported faceted STEP face ${face.type}.`);
      let normal=null;
      if(face.type==='FACE_SURFACE'){
        const plane=get(fr.pop(),'PLANE'),axis=get(refs(plane.args)[0],'AXIS2_PLACEMENT_3D'),ar=refs(axis.args);
        normal=ar.length>1?vector(ar[1],'DIRECTION'):[0,0,1];
        if(/\.F\.\s*$/.test(face.args)) normal=normal.map(x=>-x);
      }
      const bounds=fr.map(id=>get(id));
      if(bounds.filter(b=>b.type==='FACE_OUTER_BOUND').length!==1)throw Error('Faceted STEP face must have one explicit outer boundary.');
      bounds.sort((a,b)=>(b.type==='FACE_OUTER_BOUND')-(a.type==='FACE_OUTER_BOUND'));
      const loops=bounds.map(b=>{
        if(!['FACE_BOUND','FACE_OUTER_BOUND'].includes(b.type))throw Error('Unsupported STEP face boundary.');
        const loop=refs(get(refs(b.args)[0],'POLY_LOOP').args).map(index);
        if(/\.F\.\s*$/.test(b.args))loop.reverse();
        if(loop.length>1 && loop[0]===loop.at(-1))loop.pop();
        if(loop.length<3)throw Error('STEP polygon has fewer than three vertices.');
        return loop;
      });
      const p=i=>vertices.slice(i*3,i*3+3);
      if(!normal){normal=[0,0,0];const l=loops[0];for(let i=0;i<l.length;i++){const a=p(l[i]),b=p(l[(i+1)%l.length]);normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}}
      const length=Math.hypot(...normal),origin=p(loops[0][0]);
      if(!length)throw Error('Invalid STEP face normal.');
      for(const id of loops.flat()){const q=p(id);if(Math.abs(q.reduce((sum,x,k)=>sum+(x-origin[k])*normal[k],0))/length>1e-6)throw Error('Faceted STEP contains a non-planar polygon.');}
      const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),u=(axis+1)%3,v=(axis+2)%3;
      const flat=loops.flat(),projected=loops.map(l=>l.map(i=>{const a=p(i);return new Vector2(a[u],a[v]);}));
      const tris=ShapeUtils.triangulateShape(projected[0],projected.slice(1));
      if(!tris.length)throw Error('Unable to triangulate a STEP polygon.');
      const area=l=>Math.abs(l.reduce((sum,id,i)=>{const a=p(id),b=p(l[(i+1)%l.length]);return sum+a[u]*b[v]-b[u]*a[v];},0))/2;
      const expectedArea=area(loops[0])-loops.slice(1).reduce((sum,l)=>sum+area(l),0);
      let triangleArea=0;
      for(const tri of tris){const [a,b,c]=tri.map(i=>p(flat[i]));triangleArea+=Math.abs((b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]))/2;}
      if(expectedArea<=0 || Math.abs(triangleArea-expectedArea)>Math.max(1e-8,expectedArea*1e-8))throw Error('STEP polygon triangulation did not preserve its area.');
      for(const tri of tris){const ids=tri.map(i=>flat[i]),[a,b,c]=ids.map(p),cross=(b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]);if(cross*normal[axis]<0)[ids[1],ids[2]]=[ids[2],ids[1]];triangles.push(...ids);}
      if(++completed%2000===0)progress(`Reading faceted body ${bodies.length+1} of ${breps.length}: ${completed} of ${faces.length} faces`);
    }
    bodies.push({name,vertices:new Float64Array(vertices),triangles:new Uint32Array(triangles)});
  }
  // The named print body precedes intersecting reinforcement modifier bodies.
  bodies.sort((a,b)=>(b.name==='Body_PRINT')-(a.name==='Body_PRINT'));
  return { ...bodies[0], bodies };
}
