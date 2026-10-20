import {boards,makeBoardPegs} from './boards.js?v=dense-1';
import {makePegs} from './peg-fit.js?v=fit-7';
import {validateExport} from './kernel.js?v=base-types-1';

export const reinforcementMargin=3.5;
/** Full-thickness load paths, clipped to the unchanged printable body. */
export function reinforce(module,inputs,result){
 const {Manifold:M,Mesh}=module,owned=[],keep=o=>(owned.push(o),o),p=result.parameters;
 try{
  const body=keep(new M(new Mesh({numProp:3,vertProperties:result.vertices,triVerts:result.triangles})));
  const installed=keep(keep(body.translate([0,0,-result.printZShift])).rotate([-result.printRotation*180/Math.PI,0,0]));
  const set=p.board_system==='original'?makePegs(module,inputs,p,keep):makeBoardPegs(module,p,keep);
  const sites=result.kind==='coupon'&&p.board_system==='original'?[{x:0,z:0,row:0},{x:0,z:-25.4,row:1}]:p.mountSites;
  const bb=installed.boundingBox(),margin=reinforcementMargin,regions=[];
  for(const site of sites){
   const peg=site.row===0?set.upper:site.row===p.mount_rows-1?set.lower:set.locator;
   const b=peg.boundingBox(),x0=site.x+b.min[0]-margin,x1=site.x+b.max[0]+margin;
   // Continue every lower peg's column up to the adjacent frame, through both skins.
   const y0=Math.min(bb.min[1],b.min[1])-margin,y1=Math.max(5.55,b.max[1])+margin;
   const z0=site.z+b.min[2]-margin,z1=bb.max[2]+margin;
   regions.push(keep(keep(M.cube([x1-x0,y1-y0,z1-z0])).translate([x0,y0,z0])));
  }
  const region=keep(M.union(regions));
  const printed=keep(keep(region.rotate([result.printRotation*180/Math.PI,0,0])).translate([0,0,result.printZShift]));
  const tolerance=.00001+2**(Math.floor(Math.log2(Math.max(1,...bb.min.map(Math.abs),...bb.max.map(Math.abs))))-22);
  // Clip once more in the exact exported frame; do not change the main mesh.
  const clipped=keep(printed.intersect(body));
  const components=clipped.decompose();components.forEach(keep);
  const helpers=components.filter(s=>s.volume()>1e-6).map((s,i)=>{
   const clean=keep(s.simplify(tolerance)),source=clean.getMesh(),floatSolid=keep(new M(new Mesh({numProp:3,vertProperties:new Float32Array(source.vertProperties),triVerts:new Uint32Array(source.triVerts)}))),mesh=floatSolid.getMesh(),r={name:`Reinforcement_100pct_3p5mm_${i+1}`,vertices:new Float32Array(mesh.vertProperties),triangles:new Uint32Array(mesh.triVerts),volume:floatSolid.volume(),marginMM:margin};
   validateExport(r);return r;
  });
  if(!helpers.length)throw Error('No reinforcement material generated.');
  return helpers;
 }finally{for(let i=owned.length-1;i>=0;i--)owned[i].delete();}
}
