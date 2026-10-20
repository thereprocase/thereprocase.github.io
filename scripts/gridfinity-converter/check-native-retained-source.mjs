import assert from 'node:assert/strict';
import { nativeFoot, previewNative, prepareNativeDocument, convertNative, validateNativeBrepCandidate, nativeGeometrySnapshot } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const source = cad.makeBox([-20.75,-20.75,4.75],[20.75,20.75,12]).fuse(await nativeFoot());
const originalVolume = cad.measureVolume(source);
const buffer = new TextEncoder().encode(source.serialize()).buffer;
source.delete();
const {nativeDocumentId:documentId} = await previewNative({buffer,format:'brep',retainSource:true,initialDeflection:.1});
const oc = cad.getOC();
await prepareNativeDocument({documentId});
const clone = cad.Shape.prototype.clone;
let canonical, original;
// OCCT may cache a face inspection in the third (Checked) flag bit.
// All geometric data and all other topology flags must remain byte-identical.
const withoutCheckedFlag = text => text.replace(/^([01]{2})[01]([01]{4})$/gm,'$10$2');
cad.Shape.prototype.clone = function() {
  canonical = this;
  original = nativeGeometrySnapshot(oc, this);
  cad.Shape.prototype.clone = clone;
  return clone.call(this);
};
try {
  for (const [index,style] of ['plain','magnets','both','plain','magnets','plain','magnets'].entries()) {
    const scale = index === 3 ? 1.01 : 1;
    const rotated = index === 4, dx = rotated ? 3 : 0, dy = rotated ? 4 : 0;
    let prepared = false;
    const settings = {documentId,retainDocument:true,format:'brep',deferOriginalPose:true,nativeExportPreference:'brep',fastDisplay:index !== 5,scale,
      detection:{rotation:rotated?[0,-1,0,1,0,0,0,0,1]:[1,0,0,0,1,0,0,0,1],translation:[dx,dy,0],geometry:{bounds:{min:[-20.75*scale+dx,-20.75*scale+dy,0],max:[20.75*scale+dx,20.75*scale+dy,12*scale]}}},
      options:{feet:[{x:dx,y:dy,sourceX:dx,sourceY:dy}],style,bottom:0,height:4.75,fit:0,magnetDiameter:6.5,magnetDepth:2.4,screwDiameter:3,screwDepth:6,minimumRoof:.8,originalVolume:originalVolume*scale**3},
      validateBrepCandidate:validateNativeBrepCandidate,
      onProgress:stage=>{
        if(stage.startsWith('Using the prepared')) prepared = true;
        assert.notEqual(stage,'Opening native CAD…','repeat must not reimport');
        assert.notEqual(stage,'Preparing native curve consistency…','repeat must not repair again');
      },
    };
    const result = await convertNative(settings);
    assert.ok(result.brep);
    if(index === 6) assert.ok(result.report.meshTessellation.converted.reusedFaces > 0,'fresh mesh fallback must not invalidate original cache');
    assert.equal(prepared,true);
    assert.equal(result.nativeDocumentId,documentId);
    const after = nativeGeometrySnapshot(oc,canonical);
    assert.equal(withoutCheckedFlag(after),withoutCheckedFlag(original),'canonical CAD geometry must stay unchanged');
    if(index === 1) {
      await assert.rejects(()=>convertNative({documentId,retainDocument:true,bodyIndex:1,format:'brep'}));
      await assert.rejects(()=>convertNative({...settings,onProgress:stage=>{
        if(stage === 'Checking native CAD holes and solid validity…') throw Error('injected conversion error');
      }}),/injected conversion error/);
    }
  }
  await assert.rejects(()=>convertNative({documentId,retainDocument:true,bodyIndex:1,format:'brep'}));
  assert.equal(withoutCheckedFlag(nativeGeometrySnapshot(oc,canonical)),withoutCheckedFlag(original),'wrong body cannot mutate or consume canonical source');
} finally {cad.Shape.prototype.clone = clone;}
console.log(JSON.stringify({passed:true,conversions:7,scaledRepeat:true,rotatedRepeat:true,wrongBodyRecovery:true,conversionErrorRecovery:true,freshMeshCachePreserved:true}));
