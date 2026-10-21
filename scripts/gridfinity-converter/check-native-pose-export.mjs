import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { nativeFoot, convertNative, exportNativeOriginalPose } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const oc = cad.getOC(), identity = [1,0,0,0,1,0,0,0,1];
const base = cad.makeBox([0,0,0], [8,9,10]);
const step = await base.blobSTEP().arrayBuffer(), brep = new TextEncoder().encode(base.serialize()).buffer;
const angle = 37 * Math.PI / 180;
const poses = [
  { rotation: identity, translation: [0,0,0] },
  { rotation: identity, translation: [20,-5,7] },
  { rotation: [Math.cos(angle),-Math.sin(angle),0,Math.sin(angle),Math.cos(angle),0,0,0,1], translation: [20,-5,7] },
];
function expectedBounds(pose) {
  const corners=[];
  for(const x of [0,8]) for(const y of [0,9]) for(const z of [0,10]) {
    const v=[x,y,z].map((n,i)=>n-pose.translation[i]);
    corners.push([0,1,2].map(j=>[0,1,2].reduce((sum,i)=>sum+pose.rotation[i*3+j]*v[i],0)));
  }
  return [[0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))),[0,1,2].map(i=>Math.max(...corners.map(p=>p[i])))];
}
async function verify(output, pose) {
  const reopened=output.format==='step' ? await cad.importSTEP(new Blob([output.buffer])) : cad.cast(oc.BRepToolsWrapper.Read(new TextDecoder().decode(output.buffer)));
  const checker=new oc.BRepCheck_Analyzer(reopened.wrapped,true,false,true);
  try {
    assert.equal(checker.IsValid(),true);
    assert.equal(reopened.solids.length,1);
    assert.ok(Math.abs(cad.measureVolume(reopened)-720)<1e-6);
    const actual=reopened.boundingBox.bounds,expected=expectedBounds(pose);
    for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(actual[i][j]-expected[i][j])<1e-5);
  } finally {checker.delete();reopened.delete();}
}
for (const [format,buffer] of [['step',step],['brep',brep]]) {
  const original=Buffer.from(buffer).toString('base64');
  for(const pose of poses) {
    const output=await exportNativeOriginalPose({buffer,format,transform:pose});
    await verify(output,pose);
    assert.equal(Buffer.from(buffer).toString('base64'),original,'Input export bytes remain unchanged');
  }
}
for (const pose of poses) {
  // The dedicated export reader must never replace a model kernel in place.
  // Match the application's fresh-worker lifetime for STEP translation.
  const output = await new Promise((resolve, reject) => {
    const moduleURL = new URL('../../public/gridfinity-converter/native-cad.js', import.meta.url).href;
    const source = `import {parentPort,workerData} from 'node:worker_threads';
      import {exportNativeOriginalPose} from ${JSON.stringify(moduleURL)};
      parentPort.postMessage(await exportNativeOriginalPose(workerData));`;
    const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(source)), {
      workerData: { buffer: brep, format: 'brep', requestedFormat: 'step', transform: pose },
    });
    let received = false;
    worker.once('message', result => { received = true; resolve(result); worker.terminate(); });
    worker.once('error', reject);
    worker.once('exit', code => { if (!received) reject(Error(`Export worker exited before producing a result (${code})`)); });
  });
  assert.equal(output.format, 'step');
  await verify(output, pose);
}
await assert.rejects(()=>exportNativeOriginalPose({buffer:brep,format:'brep',transform:{rotation:[2,0,0,0,1,0,0,0,1],translation:[0,0,0]}}),/rigid/);
const source= cad.makeBox([-20.75,-20.75,4.75],[20.75,20.75,12]).fuse(await nativeFoot()).translate([100,20,0]);
const progress=[];
const converted=await convertNative({buffer:new TextEncoder().encode(source.serialize()).buffer,format:'brep',deferOriginalPose:true,nativeExportPreference:'brep',
  detection:{rotation:identity,translation:[-100,-20,0],geometry:{bounds:{min:[-20.75,-20.75,0],max:[20.75,20.75,12]}}},
  options:{feet:[{x:0,y:0,sourceX:0,sourceY:0}],style:'plain',bottom:0,height:4.75,fit:0,magnetDiameter:6.5,magnetDepth:2.4,screwDiameter:3,screwDepth:6,minimumRoof:.8,originalVolume:cad.measureVolume(source)},
  onProgress:message=>progress.push(message)});
assert.equal(converted.originalPoseExport.deferred,true);
assert.equal(converted.sourceStep,undefined);
assert.equal(converted.sourceBrep,undefined);
assert.ok(!progress.some(message=>message.includes('original-pose')));
assert.ok(converted.step||converted.brep);
assert.ok(converted.brep);
assert.equal(converted.report.stepExportDeferred, true);
assert.ok(!progress.some(message => message.includes('STEP')));
const wrong=cad.makeBox([0,0,0],[1,1,1]),wrongStep=wrong.blobSTEP(),wrongBrep=wrong.serialize();
const writer=Object.getOwnPropertyDescriptor(cad.Shape.prototype,'blobSTEP'), serializer=Object.getOwnPropertyDescriptor(cad.Shape.prototype,'serialize');
try {
  cad.Shape.prototype.blobSTEP=async()=>wrongStep;
  const output=await exportNativeOriginalPose({buffer:step,format:'step',transform:poses[1]});
  assert.equal(output.format,'brep');assert.match(output.report.stepExportError,/changed/);
  await verify(output,poses[1]);
  cad.Shape.prototype.serialize=()=>wrongBrep;
  await assert.rejects(()=>exportNativeOriginalPose({buffer:step,format:'step',transform:poses[1]}),/BREP export changed/);
} finally {
  Object.defineProperty(cad.Shape.prototype,'blobSTEP',writer);
  Object.defineProperty(cad.Shape.prototype,'serialize',serializer);
}
const face=base.faces[0], faceBytes=new TextEncoder().encode(face.serialize()).buffer;
await assert.rejects(()=>exportNativeOriginalPose({buffer:faceBytes,format:'brep',transform:poses[1]}),/one valid positive/);
console.log('Native original-pose export PASS: identity, translation, rotation, deferred conversion, immutable input, STEP fallback, invalid export/source blocked.');
