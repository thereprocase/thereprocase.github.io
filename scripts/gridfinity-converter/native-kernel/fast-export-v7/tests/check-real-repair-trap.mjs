import assert from 'node:assert/strict';
import {nativeFoot,prepareNativeSource} from './gridfinity-converter/native-cad.js';
import * as cad from './gridfinity-converter/vendor/replicad/replicad.js?v=fast-export-20261021-022900';
await nativeFoot().then(s=>s.delete());const oc=cad.getOC();
const flag=oc.BRep_Tool.SameParameter, repair=oc.BRepLib.SameParameter;
for(const isTrap of [true,false]){
 const source=await nativeFoot();let restored;const stages=[];let repairs=0;
 const error=isTrap?new WebAssembly.RuntimeError('injected native trap'):new Error('unsupported repair');
 oc.BRep_Tool.SameParameter=()=>false;
 oc.BRepLib.SameParameter=()=>{repairs++;throw error;};
 try{
  if(isTrap) await assert.rejects(prepareNativeSource(source,s=>stages.push(s)),e=>e===error);
  else {restored=await prepareNativeSource(source,s=>stages.push(s));assert.ok(restored.source);assert.equal(restored.sourceCurveRepair,null);}
  assert.equal(repairs,1);assert.equal(stages.some(s=>s.startsWith('Checking the original native CAD after')), !isTrap);
 } finally {oc.BRep_Tool.SameParameter=flag;oc.BRepLib.SameParameter=repair;if(restored)restored.source.delete();else source.delete();}
 console.log(JSON.stringify({isTrap,repairs,stages,passed:true}));
}
