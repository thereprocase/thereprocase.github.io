import {Worker} from 'node:worker_threads';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {nativeFoot,convertNative} from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
import {socketSections,SOCKET_STYLES} from '../../public/gridfinity-converter/socket-profile.js';
import {conversionParameters,detect,importSolid} from '../../public/gridfinity-converter/kernel.js';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
(await nativeFoot()).delete();
let source=cad.makeBox([-23,-23,0],[23,23,6.2]);
const sketches=socketSections().map(([z,w,r])=>cad.drawRoundedRectangle(w,w,r).sketchOnPlane('XY',[0,0,z]));
const pocket=sketches[0].loftWith(sketches.slice(1),{ruled:true}),next=source.cut(pocket);source.delete();pocket.delete();source=next;
if(process.env.ROTATE){const next=source.rotate(31,[0,0,0],[1,1,0]).translate([81,-12,44]);source.delete();source=next;}
const dir=process.argv[2]||'/tmp/native-sockets';fs.mkdirSync(dir,{recursive:true});
const buffer=await source.blobSTEP().arrayBuffer();fs.writeFileSync(dir+'/analytic-female-1x1.step',Buffer.from(buffer));
const m=await Module();m.setup();const mesh=source.mesh({tolerance:.01,angularTolerance:.1});const loaded=importSolid(m,{vertices:new Float32Array(mesh.vertices),triangles:new Uint32Array(mesh.triangles)}),d=detect(m,loaded.bodies[0]);
assert.equal(d.interfaceType,'female');assert.equal(d.feet.length,1);console.log('placement',JSON.stringify({bottom:d.bottom,feet:d.feet,normal:d.normal,bounds:d.bounds,rotation:d.rotation}));
const evidence=[];
for(const style of (process.env.STYLES?.split(',')||Object.keys(SOCKET_STYLES))){
 const options=conversionParameters({interfaceType:'female',feet:d.feet,bottom:d.bottom,height:6.2,style});options.originalVolume=d.geometry.volume;
 const result=await convertNative({buffer,format:'step',detection:d,options,nativeExportPreference:'brep',deferOriginalPose:true,onProgress:label=>console.log(style,label)});
 fs.writeFileSync(dir+'/'+style+'-report.json',JSON.stringify(result.report,null,2));
 assert.equal(result.report.nativeValid,true);assert.equal(result.report.brepRoundTripValid,true);assert.ok(result.report.outsideChange<.001);
 for(const pose of (process.env.ROTATE?['base-down','original']:['base-down'])){
  const moduleURL=new URL('../../public/gridfinity-converter/native-cad.js',import.meta.url).href;
  const source=`import {parentPort,workerData} from 'node:worker_threads';import {exportNativeOriginalPose} from ${JSON.stringify(moduleURL)};const diagnostics=[];const result=await exportNativeOriginalPose({...workerData,onProgress:(label,info)=>{if(info)diagnostics.push(info);}});parentPort.postMessage({...result,diagnostics});`;
  const exported=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)),{workerData:{buffer:result.brep,format:'brep',requestedFormat:'step',outputPose:pose,transform:pose==='base-down'?{rotation:[1,0,0,0,1,0,0,0,1],translation:[0,0,0]}:result.originalPoseExport.transform}});worker.once('message',r=>{resolve(r);worker.terminate();});worker.once('error',reject);});
  fs.writeFileSync(dir+'/'+style+'-'+pose+'-export.json',JSON.stringify({...exported.report,diagnostics:exported.diagnostics},null,2));assert.equal(exported.report.stepRoundTripValid,true,exported.report.stepExportError);fs.writeFileSync(dir+'/'+style+'-'+pose+'.step',Buffer.from(exported.buffer));
 }
 evidence.push(result.report);console.log(style,'PASS');
}
fs.writeFileSync(dir+'/checks.json',JSON.stringify(evidence,null,2));
