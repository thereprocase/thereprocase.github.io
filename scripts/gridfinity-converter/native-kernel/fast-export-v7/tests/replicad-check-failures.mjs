import assert from 'node:assert/strict';
import * as cad from './patched/replicad.js';
import init from '/home/repro/code/thereprocase.github.io/public/gridfinity-converter/vendor/replicad/model_exact_single.js';
const oc=await init();cad.setOC(oc);
const edgeClass=oc.BRepBuilderAPI_MakeEdge,to3d=oc.GeomLib.To3d;let made=0,deleted=0,curves=0,curvesDeleted=0;
oc.GeomLib.To3d=function(...args){const c=to3d.apply(this,args),del=c.delete.bind(c);curves++;c.delete=()=>{curvesDeleted++;del();};return c;};
Object.assign(oc.GeomLib.To3d,to3d);
oc.BRepBuilderAPI_MakeEdge=new Proxy(edgeClass,{construct(T,args){const b=new T(...args),del=b.delete.bind(b);made++;b.delete=()=>{deleted++;del();};if(made===3)b.Edge=()=>{throw Error('edge result failure');};return b;}});
assert.throws(()=>cad.drawRoundedRectangle(35.6,35.6,.8).sketchOnPlane('XY'),/edge result failure/);
assert.equal(made,deleted);assert.equal(curves,curvesDeleted);oc.BRepBuilderAPI_MakeEdge=edgeClass;oc.GeomLib.To3d=to3d;
const loftClass=oc.BRepOffsetAPI_ThruSections;const results=[];
for(const mode of ['build-error','build-trap','cast-error']){
 let builders=0,disposed=0,raws=0,rawsDisposed=0;
 const sketches=[0,1].map(z=>cad.drawRoundedRectangle(35.6,35.6,.8).sketchOnPlane('XY',[0,0,z]));
 const injected=mode==='build-trap'?new WebAssembly.RuntimeError('injected native trap'):Error('injected '+mode);
 oc.BRepOffsetAPI_ThruSections=new Proxy(loftClass,{construct(T,args){const b=new T(...args),del=b.delete.bind(b);builders++;b.delete=()=>{disposed++;del();};
 if(mode.startsWith('build'))b.Build=()=>{throw injected;};else{const shape=b.Shape.bind(b);b.Shape=()=>{const raw=shape(),release=raw.delete.bind(raw);raws++;raw.delete=()=>{rawsDisposed++;release();};raw.ShapeType=()=>{throw injected;};return raw;};}return b;}});
 try{assert.throws(()=>sketches[0].loftWith(sketches.slice(1),{ruled:true}),e=>e===injected);}finally{oc.BRepOffsetAPI_ThruSections=loftClass;sketches.forEach(s=>s.delete());}
 assert.equal(builders,disposed);assert.equal(raws,rawsDisposed);results.push({mode,builders,disposed,raws,rawsDisposed});
}
console.log(JSON.stringify({passed:true,edgeFailure:{made,deleted,curves,curvesDeleted},loftFailures:results}));
