import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {nativeFoot} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import {prepareNativeLocalEdit} from '../../public/gridfinity-converter/native-local-edit.js';
await nativeFoot();const oc=cad.getOC();
function boolean(kind,a,b){const op=new oc['BRepAlgoAPI_'+kind](),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();try{args.Append(a.wrapped);tools.Append(b.wrapped);op.SetArguments(args);op.SetTools(tools);op.SetNonDestructive(true);op.SetFuzzyValue(.00001);op.Build();assert.equal(op.IsDone(),true);return cad.cast(op.Shape());}finally{op.delete();args.delete();tools.delete();}}
const cut=(a,b)=>boolean('Cut',a,b),fuse=(a,b)=>boolean('Fuse',a,b),common=(a,b)=>boolean('Common',a,b),union=shapes=>shapes.reduce((a,b)=>a?fuse(a,b):b,null),volume=s=>s.isNull?0:Math.abs(cad.measureVolume(s));
function valid(s){const c=new oc.BRepCheck_Analyzer(s.wrapped,true,false,true);try{return c.IsValid()&&s.solids.length===1;}finally{c.delete();}}
async function toolsFor(feet,style,fit,bottom=0){const C=[],F=[],H=[];for(const f of feet){C.push(cad.makeBox([Math.min(f.x,f.sourceX??f.x)-20.99,Math.min(f.y,f.sourceY??f.y)-20.99,bottom-.02],[Math.max(f.x,f.sourceX??f.x)+20.99,Math.max(f.y,f.sourceY??f.y)+20.99,bottom+4.75]));F.push(await nativeFoot(f.x,f.y,bottom,4.77,fit));for(const dx of [-13,13])for(const dy of [-13,13]){if(['magnets','both'].includes(style))H.push(cad.makeCylinder(3.25,2.42,[f.x+dx,f.y+dy,bottom-.02]));if(['screws','both'].includes(style))H.push(cad.makeCylinder(1.5,6.02,[f.x+dx,f.y+dy,bottom-.02]));}}return{C:union(C),F:union(F),H:H.length?union(H):null};}
function oldResult(S,{C,F,H}){const plain=fuse(cut(S,C),F);return{plain,result:H?cut(plain,H):plain};}
function newResult(S,{C,F,H}){return H?fuse(cut(S,union([C,H])),cut(F,H)):fuse(cut(S,C),F);}
function timed(fn){const start=performance.now(),result=fn();return{ms:performance.now()-start,result};}
async function check(S,feet,style,fit,bottom=0){
 const tools=await toolsFor(feet,style,fit,bottom), original=oldResult(S,tools);
 const local=await prepareNativeLocalEdit({cad,source:S,feet,bottom,height:4.75,fit,maximumHoleDepth:6,maximumHoleRadius:3.25,roof:.8,nativeFoot,cut,fuse,intersect:common,union,volume});
 const result=local.assemble(tools.H);
 try {
  assert.equal(valid(original.result),true);assert.equal(valid(result),true);
  const differences=[volume(cut(original.result,result)),volume(cut(result,original.result))];
  assert.ok(differences.every(v=>v<1e-6),JSON.stringify(differences));
  const expectedLocal=common(original.plain,local.editBox);
  const localDifferences=[volume(cut(local.localPlain,expectedLocal)),volume(cut(expectedLocal,local.localPlain))];
  assert.ok(localDifferences.every(v=>v<1e-6),JSON.stringify(localDifferences));
  return{style,fit,feet:feet.length,differences,localDifferences};
 }finally{result.delete();local.dispose();}
}
const all=[{x:0,y:0},{x:42,y:0}];
let S=cad.makeBox([-20.75,-20.75,4.75],[62.75,20.75,12]);for(const f of all)S=fuse(S,await nativeFoot(f.x,f.y));
const results=[];for(const style of ['plain','magnets','screws','both'])for(const fit of [-.5,.5]){results.push(await check(S,style==='both'?[all[0]]:all,style,fit));console.log(results.at(-1));}
results.push(await check(S,[{x:.2,y:-.2,sourceX:0,sourceY:0}],'both',.5));
const hollow=cut(S,cad.makeBox([-18,-18,5.2],[60,18,13]));
results.push(await check(hollow,[all[0]],'both',-.5));
console.log('Native local edit equivalence PASS: four styles, fit extremes, partial feet, shifted centers, hollow body.');
