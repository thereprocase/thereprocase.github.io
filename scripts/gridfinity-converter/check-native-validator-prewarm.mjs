import assert from 'node:assert/strict';
import { prewarmNativeBrepValidator } from '../../public/gridfinity-converter/native-worker-run.js';
const OriginalWorker=globalThis.Worker;
const workers=[];
let throwOnStart=true;
class FakeWorker {
  constructor(){if(throwOnStart)throw Error('Worker unavailable');workers.push(this);}
  postMessage(data){assert.equal(data.type,'warm');queueMicrotask(()=>this.onmessage({data:{warming:true}}));}
  terminate(){this.terminated=true;}
}
try {
  globalThis.Worker=FakeWorker;
  await prewarmNativeBrepValidator(); // Optional startup failure never blocks loading.
  throwOnStart=false;
  const started=prewarmNativeBrepValidator();
  assert.equal(prewarmNativeBrepValidator(),started,'Repeated warm requests share one child');
  await started; // Resolves when JS starts, without waiting for kernel compilation.
  assert.equal(workers.length,1);
  workers[0].onmessage({data:{warm:true,warmedAtMS:Date.now()}});
  workers[0].onerror();
  assert.equal(workers[0].terminated,true);
  await prewarmNativeBrepValidator();
  assert.equal(workers.length,2,'A failed prewarm allows a fresh child');
  workers[1].onmessage({data:{error:'Kernel unavailable'}});
  assert.equal(workers[1].terminated,true);
} finally {globalThis.Worker=OriginalWorker;}
console.log('Native validator prewarm lifecycle PASS: optional failure, one cached child, early startup acknowledgement, failed-kernel disposal and retry.');
