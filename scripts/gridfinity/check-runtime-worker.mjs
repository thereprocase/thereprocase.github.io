import assert from 'node:assert/strict';
globalThis.addEventListener=()=>{};
class FakeWorker extends EventTarget {
  constructor(){super();this.listener=null;}
  set onmessage(callback){if(this.listener)this.removeEventListener('message',this.listener);this.listener=callback;if(callback)this.addEventListener('message',callback);}
  terminate(){this.terminated=true;}
  reply(data){this.dispatchEvent(new MessageEvent('message',{data}));}
}
globalThis.Worker=FakeWorker;
const progress={hidden:true,removeAttribute(){},setAttribute(){}};
globalThis.document={getElementById:()=>progress,documentElement:{dataset:{}}};
const {taskWorker}=await import('../../public/gridfinity-common/generator-runtime.js');
const status={textContent:'Building',dataset:{}};
let results=0;const old=taskWorker('old',status);old.onmessage=()=>results++;old.reply({progress:{label:'Validating tile 1 of 4',completed:1,total:4}});assert.equal(results,0);assert.equal(progress.value,1);old.terminate();assert.equal(document.documentElement.dataset.lastTaskOutcome,'cancelled');old.reply({result:{}});assert.equal(results,0);
const current=taskWorker('current',status);current.onmessage=({data})=>{assert(data.wallMS>=0);results++;current.terminate();status.textContent='Geometry ready';};old.reply({error:'late failure'});current.reply({result:{}});await new Promise(r=>setTimeout(r,10));assert.equal(results,1);assert(progress.hidden);assert.match(status.textContent,/Geometry ready · [0-9.]+ s/);assert.equal(document.documentElement.dataset.lastTaskOutcome,'success');console.log('Progress, queued stale reply, termination and wall-time publication: PASS');
