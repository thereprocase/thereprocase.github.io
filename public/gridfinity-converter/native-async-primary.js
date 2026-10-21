// Active/quarantined jobs hold strong references, so Embind finalizers cannot
// delete a running native thread. A poisoned kernel must be terminated by its owner.
const active = new Set(), quarantine = new Set();
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
export const isNativeKernelPoison = error => error instanceof WebAssembly.RuntimeError || error?.nativeKernelPoisoned === true;
export function quarantineNativeOwnership(...values) { values.forEach(value => {if(value)quarantine.add(value);}); }
function poisonError(error) {
 if(error instanceof WebAssembly.RuntimeError)return error;
 const poisoned=new WebAssembly.RuntimeError(`Native asynchronous validation lifecycle failed: ${error?.message ?? error}`);
 poisoned.cause=error;poisoned.nativeKernelPoisoned=true;return poisoned;
}
export function beginNativeAsyncPrimary(oc, snapshot, onProgress=()=>{}) {
 const entry={snapshot,job:null,retired:false,poisoned:false,result:null,startedAtMS:Date.now()};
 active.add(entry);
 const poison=error=>{entry.poisoned=true;quarantine.add(entry);active.delete(entry);return poisonError(error);};
 try {entry.job=new oc.NativeAsyncExactJob(snapshot.wrapped);}
 catch(error){throw poison(error);}
 const poll=()=>{
  if(entry.poisoned)throw poisonError('Attempted to reuse poisoned native validation');
  if(entry.retired)return entry.result;
  let joined;
  try {joined=entry.job.tryJoinFinished();}
  catch(error){throw poison(error);}
  if(!joined)return null;
  try {
   entry.result={passed:entry.job.passed(),error:entry.job.error(),elapsedMS:entry.job.elapsedMS(),
    startedAtMS:entry.startedAtMS,finishedAtMS:Date.now(),retirement:'pthread-tryjoin',poolBudgetRestored:true};
   entry.job.delete();entry.job=null;entry.retired=true;active.delete(entry);
  }catch(error){throw poison(error);}
  onProgress('Native primary validation retired.',{diagnostic:'native-primary-job-retired',...entry.result});
  return entry.result;
 };
 return {poll,poison,startedInfo:{diagnostic:'native-primary-job-started',startedAtMS:entry.startedAtMS,checkParticipants:2,mainParticipants:2,deepSnapshot:true}, get retired(){return entry.retired;},
  async drain(){let result;while(!(result=poll()))await pause();return result;},
  async complete(checkCancelled=()=>{}){let result;while(!(result=poll())){checkCancelled();await pause();}return result;},
 };
}
