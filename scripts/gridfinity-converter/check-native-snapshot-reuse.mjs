import assert from 'node:assert/strict';
import { nativeFoot, previewNative, prepareNativeDocument, convertNative, validateNativeBrepCandidate } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const source = cad.makeBox([-20.75,-20.75,4.75],[20.75,20.75,12]).fuse(await nativeFoot());
const originalVolume = cad.measureVolume(source);
const buffer = new TextEncoder().encode(source.serialize()).buffer;
source.delete();
const {nativeDocumentId:documentId} = await previewNative({buffer,format:'brep',retainSource:true,initialDeflection:.1});
const oc = cad.getOC(), Transform = oc.BRepBuilderAPI_Transform;
let copies = 0, sawProvenance = false, candidateCopies;
oc.BRepBuilderAPI_Transform = new Proxy(Transform,{construct(Target,args){
  if(args[2] === true && args[3] === false) copies++;
  return new Target(...args);
}});
try {
  await prepareNativeDocument({documentId,onProgress:(_,info)=>{
    if(info?.diagnostic === 'native-validation') sawProvenance = info.meshFreeDisplayCopy;
  }});
  assert.equal(sawProvenance,true);
  assert.equal(copies,2,'only before and after geometry copies; final validity reuses after copy');
  const result = await convertNative({documentId,format:'brep',deferOriginalPose:true,nativeExportPreference:'brep',fastDisplay:true,
    detection:{rotation:[1,0,0,0,1,0,0,0,1],translation:[0,0,0],geometry:{bounds:{min:[-20.75,-20.75,0],max:[20.75,20.75,12]}}},
    options:{feet:[{x:0,y:0,sourceX:0,sourceY:0}],style:'plain',bottom:0,height:4.75,fit:0,magnetDiameter:6.5,magnetDepth:2.4,screwDiameter:3,screwDepth:6,minimumRoof:.8,originalVolume},
    validateBrepCandidate:validateNativeBrepCandidate,
    onProgress:(stage,info)=>{
      if(stage === 'Checking native CAD holes and solid validity…') copies = 0;
      if(stage === 'Checking exact result geometry…') assert.equal(info.meshFreeDisplayCopy,true);
      if(stage === 'Preparing the exact edit region…') candidateCopies = copies;
    },
  });
  assert.ok(result.brep);
  assert.equal(candidateCopies,1,'candidate serialization and primary exact validity share a copy');
} finally {oc.BRepBuilderAPI_Transform = Transform;}
console.log(JSON.stringify({passed:true,sourceCopies:2,resultCopies:1}));
