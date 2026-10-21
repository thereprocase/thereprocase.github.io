import assert from 'node:assert/strict';
import init from './build-config/primary_async_multi_pool4.js';
import * as cad from '/home/repro/code/thereprocase.github.io/public/gridfinity-converter/vendor/replicad/replicad.js';
const oc=await init({pthreadPoolSize:4});cad.setOC(oc);const pool=oc.OSD_ThreadPool.DefaultPool(4);pool.Init(4);pool.SetNbDefaultThreadsToLaunch(4);
assert.equal(typeof oc.NativeAsyncExactJob,'function');assert.equal(oc.nativeAsyncAuditTrapNext,undefined);
for(const fail of [false,true]){
 const s=fail?new oc.TopoDS_Shape():cad.makeBox([0,0,0],[2,3,4]).wrapped;const before=fail?null:oc.BRepToolsWrapper.Write(s);const job=new oc.NativeAsyncExactJob(s);assert.equal(pool.NbDefaultThreadsToLaunch(),2);
 let polls=0;while(!job.tryJoinFinished()){polls++;await new Promise(r=>setTimeout(r,5));if(polls>1000)throw Error('retirement timeout');}
 assert.equal(pool.NbDefaultThreadsToLaunch(),4);assert.equal(job.passed(),!fail);assert.equal(Boolean(job.error()),fail);if(!fail)assert.equal(oc.BRepToolsWrapper.Write(s),before);console.log(JSON.stringify({fail,polls,elapsedMS:job.elapsedMS(),passed:job.passed(),error:job.error(),poolRestored:true}));job.delete();s.delete();
}
pool.delete();process.exit(0);
