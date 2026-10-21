import assert from 'node:assert/strict';
import {createNativeExportWarmPool} from '/tmp/export-startup-site/gridfinity-converter/native-export-warm-pool.js';
import {createSourceBoundsModuleWarmup,startParallelSourceBounds} from '/tmp/export-startup-site/gridfinity-converter/native-parallel-source-bounds.js';
let now=0,next=1;const timers=new Map(),oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
globalThis.setTimeout=(fn,ms)=>{const id=next++;timers.set(id,{fn,at:now+ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const advance=ms=>{const end=now+ms;while(true){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;};
class FakeWorker {terminated=0;sent=[];postMessage(data){this.sent.push(data);}terminate(){this.terminated++;}emit(data){this.onmessage?.({data});}}
try {
 const made=[];const pool=createNativeExportWarmPool({createWorker:()=>{const w=new FakeWorker();made.push(w);return w;},startupMS:30,idleMS:60});
 const first=pool.prewarm();made[0].emit({warm:true,elapsedMS:2});await first;
 advance(45);await pool.prewarm();advance(20);assert.equal(made[0].terminated,0,'recent conversion must renew idle expiry');assert.equal(made.length,1);
 advance(39);const lease=await pool.acquire();assert.equal(lease.prewarmed,true);advance(100);assert.equal(made[0].terminated,0,'acquired worker has no idle expiry');await pool.prewarm();assert.equal(made.length,1);lease.release();assert.equal(made[0].terminated,1);
 const second=pool.prewarm();made[1].emit({warm:true});await second;pool.dispose();advance(100);assert.equal(made[1].terminated,1);assert.equal(timers.size,0);
 let w=new FakeWorker(),warm=createSourceBoundsModuleWarmup({createWorker:()=>w,timeoutMS:30});assert.equal(w.sent[0].type,'warm-module');w.emit({type:'module-ready'});assert.equal(await warm.ready,true);assert.equal(warm.take(),w);assert.equal(warm.take(),null);warm.dispose();assert.equal(w.terminated,0,'transferred worker owned by task');
 const task=startParallelSourceBounds({buffer:new ArrayBuffer(8),transform:{rotation:[1,0,0,0,1,0,0,0,1],translation:[0,0,0]}},()=>{},{worker:w});w.emit({type:'started',childStartedAtMS:1});assert.equal((await task.started).ready,true);task.cancel();assert.equal((await task.result).error,'Bounds task cancelled');assert.equal(w.terminated,1);w.emit({result:{bounds:[[0,0,0],[1,1,1]]}});assert.equal(w.terminated,1,'late reply cannot revive task');
 w=new FakeWorker();warm=createSourceBoundsModuleWarmup({createWorker:()=>w,timeoutMS:30});const stale=w.onmessage;warm.dispose();stale({data:{type:'module-ready'}});assert.equal(await warm.ready,false);assert.equal(warm.take(),null);assert.equal(w.terminated,1);
 w=new FakeWorker();warm=createSourceBoundsModuleWarmup({createWorker:()=>w,timeoutMS:30});advance(30);assert.equal(await warm.ready,false);assert.equal(w.terminated,1);assert.equal(timers.size,0);
 w=new FakeWorker();warm=createSourceBoundsModuleWarmup({createWorker:()=>w,timeoutMS:30});w.onerror();assert.equal(await warm.ready,false);assert.equal(warm.take(),null);assert.equal(w.terminated,1);
 console.log(JSON.stringify({passed:true,idleRefresh:true,boundedOneSlot:true,acquiredNeverExpired:true,disposeClearsTimers:true,moduleOnlyWarmup:true,transferOnce:true,taskCancellationSettles:true,lateReplyIgnored:true,warmTimeoutAndError:true}));
}finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
