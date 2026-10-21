import {socketPlan} from './socket-profile.js?v=female-bases-20261021-3';
/** Exact BREP socket tools; the native validation/export pipeline is shared. */
export function prepareNativeSocketEdit({cad,source,parameters:p,cut,fuse,intersect,union,volume,cylinder,own,checkCancelled}){
 const plan=socketPlan(p),keep=own;
 const tool=s=>{
  checkCancelled();
  if(s.kind==='box')return keep(cad.makeBox(s.lo,s.hi));
  if(s.kind==='cylinder')return cylinder(s.radius,s.height,[s.x,s.y,s.z]);
  const sketches=s.sections.map(([z,w,r])=>cad.drawRoundedRectangle(w,w,r).sketchOnPlane('XY',[s.x,s.y,z]));
  return keep(sketches[0].loftWith(sketches.slice(1),{ruled:true}));
 };
 const fills=plan.fills.map(tool),cuts=plan.cuts.map(tool);
 for(const box of plan.fills){
  // Inset the contact probe: transformed source skins can be within the boolean
  // tolerance of a tool cap. Check the interior instead of coincident caps.
  const probe=keep(cad.makeBox(box.lo.map(v=>v+.1),box.hi.map(v=>v-.1)));
  const contact=intersect(source,probe);try{if(volume(contact)<1)throw Error('A selected socket has no supporting native material. Review its center and rim plane.');}finally{contact.delete();probe.delete();}
 }
 const fill=union(fills),holes=union(cuts);
 const margin=22,xs=p.feet.map(f=>f.x),ys=p.feet.map(f=>f.y);
 const editBox=keep(cad.makeBox([Math.min(...xs)-margin,Math.min(...ys)-margin,p.bottom-.1],[Math.max(...xs)+margin,Math.max(...ys)+margin,p.bottom+plan.depth+.1]));
 const localSource=intersect(source,editBox);
 return {effectiveDepth:plan.depth,socketFloor:plan.floor,editBox,localSource,localPlain:localSource,regions:[...fills,...cuts],assemble(){checkCancelled();const filled=fuse(source,fill);try{return cut(filled,holes);}finally{filled.delete();}}};
}
