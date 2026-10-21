import assert from 'node:assert/strict';
import {nativeFoot,previewNative,prepareNativeDocument,convertNative,hasPreparedNativeDocument,nativeGeometrySnapshot} from '/tmp/cooperative-cancel-site/gridfinity-converter/native-cad.js';
import {createNativeCancellation} from '/tmp/cooperative-cancel-site/gridfinity-converter/native-cancellation.js';
import * as cad from '/tmp/cooperative-cancel-site/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();const oc=cad.getOC();
const source=cad.makeBox([-20.75,-20.75,4.75],[20.75,20.75,12]).fuse(await nativeFoot());const originalVolume=cad.measureVolume(source);const buffer=new TextEncoder().encode(source.serialize()).buffer;source.delete();
const {nativeDocumentId:documentId}=await previewNative({buffer,format:'brep',retainSource:true,initialDeflection:.1});await prepareNativeDocument({documentId});
const settings={documentId,retainDocument:true,format:'brep',deferOriginalPose:true,nativeExportPreference:'brep',fastDisplay:true,detection:{rotation:[1,0,0,0,1,0,0,0,1],translation:[0,0,0],geometry:{bounds:{min:[-20.75,-20.75,0],max:[20.75,20.75,12]}}},options:{feet:[{x:0,y:0}],style:'magnets',bottom:0,height:4.75,fit:0,magnetDiameter:6.5,magnetDepth:2.4,screwDiameter:3,screwDepth:6,minimumRoof:.8,originalVolume}};
let canonical,before;const clone=cad.Shape.prototype.clone;const normalize=text=>text.replace(/^([01]{2})[01]([01]{4})$/gm,'$10$2');
cad.Shape.prototype.clone=function(){canonical=this;before=nativeGeometrySnapshot(oc,this);cad.Shape.prototype.clone=clone;return clone.call(this);};
const stages=['Matching native CAD to the detected part…','Preparing the shared native edit region…','Checking attachment 1 of 1…','Checking exact result geometry…','Checking preserved CAD boundary faces…','Preparing CAD preview…'];const results=[];
for(const stage of stages){
 const token=new Int32Array(new SharedArrayBuffer(4)),control=createNativeCancellation(token.buffer,true);let hit=false;
 await assert.rejects(convertNative({...settings,checkCancelled:control.check,waitForCancellation:control.wait,onProgress:p=>{if(p===stage){hit=true;Atomics.store(token,0,1);}}}),e=>control.isCancellation(e));assert.ok(hit,stage);assert.ok(hasPreparedNativeDocument(documentId));assert.equal(normalize(nativeGeometrySnapshot(oc,canonical)),normalize(before));
 const result=await convertNative(settings);assert.ok(result.report.nativeValid);assert.equal(result.nativeDocumentId,documentId);assert.ok(result.report.usedPreparedSource);results.push(stage);
}
// A trap concurrent with cancellation must never become our AbortError via finally.
const token=new Int32Array(new SharedArrayBuffer(4)),control=createNativeCancellation(token.buffer,true),analyzer=oc.BRepCheck_Analyzer;
try {await assert.rejects(convertNative({...settings,checkCancelled:control.check,onProgress:p=>{if(p==='Checking exact result geometry…'){Atomics.store(token,0,1);oc.BRepCheck_Analyzer=function(){throw new WebAssembly.RuntimeError('injected native trap');};}}}),e=>e instanceof WebAssembly.RuntimeError && !control.isCancellation(e));}finally{oc.BRepCheck_Analyzer=analyzer;}
// Cancellation cannot leave a task awaiting child readiness/results forever.
const t=new Int32Array(new SharedArrayBuffer(4)),c=createNativeCancellation(t.buffer,true);setTimeout(()=>Atomics.store(t,0,1),10);await assert.rejects(c.wait(new Promise(()=>{})),e=>c.isCancellation(e));
console.log(JSON.stringify({passed:true,cancelledStages:results,successfulRetries:6,sourceUnchanged:true,trapPriority:true,awaitCancellation:true}));
