import assert from 'node:assert/strict';
import { nativeFoot, convertNative, validateNativeBrepCandidate } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const box=cad.makeBox([0,0,0],[8,9,10]);
const candidateText=box.serialize(), expectedVolume=cad.measureVolume(box);
const validated=await validateNativeBrepCandidate({candidateText,expectedVolume});
assert.equal(new TextDecoder().decode(validated.buffer),candidateText);
await assert.rejects(()=>validateNativeBrepCandidate({candidateText,expectedVolume:expectedVolume+1}),/changed the solid/);
await assert.rejects(()=>validateNativeBrepCandidate({candidateText,expectedVolume:NaN}),/positive expected volume/);
await assert.rejects(()=>validateNativeBrepCandidate({candidateText:box.faces[0].serialize(),expectedVolume:1}),/fails validation/);
const serializer=Object.getOwnPropertyDescriptor(cad.Shape.prototype,'serialize');
const shifted=box.clone().translate([10,0,0]).serialize();
try {
  cad.Shape.prototype.serialize=()=>shifted;
  const mismatch=await validateNativeBrepCandidate({candidateText,expectedVolume});
  assert.equal(mismatch.fallbackRequired,true);
  assert.equal(mismatch.buffer,undefined);
} finally {Object.defineProperty(cad.Shape.prototype,'serialize',serializer);}
const source=cad.makeBox([-20.75,-20.75,4.75],[20.75,20.75,12]).fuse(await nativeFoot());
const settings={buffer:new TextEncoder().encode(source.serialize()).buffer,format:'brep',deferOriginalPose:true,nativeExportPreference:'brep',fastDisplay:true,
 detection:{rotation:[1,0,0,0,1,0,0,0,1],translation:[0,0,0],geometry:{bounds:{min:[-20.75,-20.75,0],max:[20.75,20.75,12]}}},
 options:{feet:[{x:0,y:0,sourceX:0,sourceY:0}],style:'plain',bottom:0,height:4.75,fit:0,magnetDiameter:6.5,magnetDepth:2.4,screwDiameter:3,screwDepth:6,minimumRoof:.8,originalVolume:cad.measureVolume(source)}};
let checked=0;
const result=await convertNative({...settings,validateBrepCandidate:async data=>{checked++;return validateNativeBrepCandidate(data);}});
assert.equal(checked,1);assert.ok(result.brep);
await assert.rejects(()=>convertNative({...settings,validateBrepCandidate:async()=>{throw Error('Child validation failed');}}),/Child validation failed/);
const fallback=await convertNative({...settings,validateBrepCandidate:async()=>({fallbackRequired:true})});assert.ok(fallback.brep);
await assert.rejects(()=>convertNative({...settings,validateBrepCandidate:async()=>({})}),/no validated export/);
// A successful child cannot publish if the independent primary proof fails.
let childStarted=false;
await assert.rejects(()=>convertNative({...settings,validateBrepCandidate:async data=>{childStarted=true;return validateNativeBrepCandidate(data);},onProgress:stage=>{if(stage==='Checking preserved CAD boundary faces…')throw Error('Primary proof failed');}}),/Primary proof failed/);
assert.equal(childStarted,true);
let childReady=false;
await convertNative({...settings,validateBrepCandidate:data=>{
  const ready=new Promise(resolve=>setTimeout(()=>{childReady=true;resolve();},10));
  const task=ready.then(()=>validateNativeBrepCandidate(data));
  task.ready=ready;
  return task;
},onProgress:stage=>{if(stage==='Checking exact result geometry…')assert.equal(childReady,true,'Primary validation awaits child startup');}});
const oc=cad.getOC(), Analyzer=oc.BRepCheck_Analyzer;
try {
  await assert.rejects(()=>convertNative({...settings,validateBrepCandidate:async data=>{
    const output=await validateNativeBrepCandidate(data);
    return output;
  },onProgress:stage=>{
    if(stage==='Checking native CAD holes and solid validity…') {
      // Exercise the primary exact-check rejection independently of the child.
      oc.BRepCheck_Analyzer=new Proxy(Analyzer,{construct(Target,args){
        oc.BRepCheck_Analyzer=Analyzer;
        const check=new Target(...args);
        return {IsValid:()=>false,delete:()=>check.delete()};
      }});
    }
  }}),/not one valid solid/);
} finally {oc.BRepCheck_Analyzer=Analyzer;}
console.log('Parallel BREP gates PASS: candidate validation, volume/solid rejection, child failure, primary failure, unsupported fallback, malformed response.');
