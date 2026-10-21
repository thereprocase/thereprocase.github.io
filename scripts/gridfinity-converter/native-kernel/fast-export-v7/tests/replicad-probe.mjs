import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const mode=process.argv[2];const cad=await import(`./${mode}/replicad.js`);
const {default:init}=await import('/home/repro/code/thereprocase.github.io/public/gridfinity-converter/vendor/replicad/model_exact_multi_pool4.js');
const oc=await init({pthreadPoolSize:4});cad.setOC(oc);
let rawReturns=0,rawDeletes=0,builderCreates=0,builderDeletes=0;
const originalShape=oc.BRepOffsetAPI_ThruSections.prototype.Shape;
oc.BRepOffsetAPI_ThruSections.prototype.Shape=function(...args){const raw=originalShape.apply(this,args);rawReturns++;const del=raw.delete.bind(raw);raw.delete=()=>{rawDeletes++;del();};return raw;};
const originalBuilder=oc.BRepBuilderAPI_MakeEdge;
oc.BRepBuilderAPI_MakeEdge=new Proxy(originalBuilder,{construct(Target,args){const b=new Target(...args);builderCreates++;const del=b.delete.bind(b);b.delete=()=>{builderDeletes++;del();};return b;}});
const stats=()=>oc.nativeMimallocCurrentThreadStats(false);
const gc=async()=>{for(let i=0;i<3;i++){globalThis.gc();await new Promise(r=>setImmediate(r));}};
const results={mode,before:stats(),rounds:[],geometry:[]};
for(let round=0;round<10;round++){
 for(let i=0;i<4;i++){
 const sketches=[[0,35.6,.8],[.8,37.2,1.6],[2.6,37.2,1.6],[4.75,41.5,3.75]].map(([z,w,r])=>cad.drawRoundedRectangle(w,w,r).sketchOnPlane('XY',[i*42,0,z]));
 const foot=sketches[0].loftWith(sketches.slice(1),{ruled:true});
 if(round===0){const c=new oc.BRepCheck_Analyzer(foot.wrapped,true,false,true);assert(c.IsValid());c.delete();const props=new oc.GProp_GProps();oc.BRepGProp.VolumeProperties(foot.wrapped,props,false,false,false);results.geometry.push({volume:props.Mass(),brepSHA256:crypto.createHash('sha256').update(foot.serialize()).digest('hex')});props.delete();}
 foot.delete();
 }
 const immediate=stats();await gc();results.rounds.push({round,immediate,afterGC:stats()});
}
results.ownership={rawReturns,rawDeletes,builderCreates,builderDeletes};
fs.writeFileSync(new URL(`./${mode}.json`,import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify({mode,before:results.before,first:results.rounds[0],last:results.rounds.at(-1),ownership:results.ownership}));

process.exit(0);
