import { BOUNDS_KERNELS } from './native-bounds-build.js?v=native-step-20261021-3';
import { properRigidPose } from './native-source-certificate.js?v=native-step-20261021-3';
export async function boundsInputIdentity(buffer,pose){
 if(!(buffer instanceof ArrayBuffer)||!properRigidPose(pose))throw Error('Invalid bounds request.');
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return {sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),bytes:buffer.byteLength,pose:JSON.stringify(pose)};
}
export function validateBoundsReply(reply,input,kernelInfo){
 const b=reply?.bounds;
 if(!reply || !reply.identity || reply.identity.sha256!==input.sha256 || reply.identity.bytes!==input.bytes || reply.identity.pose!==input.pose || reply.kernelSHA256!==BOUNDS_KERNELS[kernelInfo.engine] || !Array.isArray(b)||b.length!==2||!b.every(row=>Array.isArray(row)&&row.length===3&&row.every(Number.isFinite))||!b[0].every((v,i)=>v<=b[1][i]))throw Error('Parallel source bounds identity or metrics mismatch.');
 return b;
}
export function startParallelSourceBounds({buffer,transform:pose},onProgress,{worker:preparedWorker}={}){
 let child,settled=false,timer,startTimer,resolve,resolveStarted,startSettled=false;
 const parentStartedAtMS=performance.timeOrigin+performance.now(), began=performance.now();
 const result=new Promise(r=>resolve=r), started=new Promise(r=>resolveStarted=r);
 const report=(...args)=>{try{onProgress(...args);}catch{/* Diagnostic observers cannot disrupt worker cleanup. */}};
 const markStarted=value=>{if(startSettled)return;startSettled=true;clearTimeout(startTimer);resolveStarted(value);};
 const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(startTimer);child?.terminate();markStarted(value);resolve(value);};
 try{
  child=preparedWorker ?? new Worker(new URL('./native-source-bounds-worker.js?v=native-step-20261021-3',import.meta.url),{type:'module'});
  child.onmessage=({data})=>{
   if(settled)return;
   const payload=data&&typeof data==='object'?data:{error:'Malformed bounds worker response'};
   if(payload.type==='started'){
    if(!Number.isFinite(payload.childStartedAtMS)){finish({error:'Invalid bounds startup acknowledgment'});return;}
    report('Parallel source bounds started…',{diagnostic:'parallel-source-bounds',stage:'started',parentStartedAtMS,childStartedAtMS:payload.childStartedAtMS,parentAckAtMS:performance.timeOrigin+performance.now(),startupWaitMS:performance.now()-began});
    markStarted({ready:true,childStartedAtMS:payload.childStartedAtMS});return;
   }
   try{report('Parallel source bounds finished…',{diagnostic:'parallel-source-bounds',...payload.result?.timings,childTotalMS:payload.result?.timings?.totalMS,childStartedAtMS:payload.childStartedAtMS,childFinishedAtMS:payload.childFinishedAtMS,parentStartedAtMS,parentReceivedAtMS:performance.timeOrigin+performance.now(),capacityBytes:payload.result?.capacityBytes,error:payload.error,parentTotalMS:performance.now()-began});}
   finally{finish(payload.result?{value:payload.result}:{error:payload.error||'Missing bounds result'});}
  };
  child.onerror=e=>finish({error:e.message||'Bounds worker failed'});child.onmessageerror=()=>finish({error:'Bounds worker response unreadable'});
  const copy=buffer.slice(0);child.postMessage({buffer:copy,pose},[copy]);
  timer=setTimeout(()=>finish({error:'Bounds worker timed out'}),120000);
  startTimer=setTimeout(()=>finish({error:'Bounds worker startup timed out'}),3000);
  report('Computing source bounds in parallel…',{diagnostic:'parallel-source-bounds',stage:'start',parentStartedAtMS,inputBytes:buffer.byteLength});
 }catch(e){finish({error:e.message});}
 return {result,started,cancel:()=>finish({error:'Bounds task cancelled'})};
}

/** One module-only child. Ownership transfers once, or disposal terminates it. */
export function createSourceBoundsModuleWarmup({createWorker=()=>new Worker(new URL('./native-source-bounds-worker.js?v=native-step-20261021-3',import.meta.url),{type:'module'}),timeoutMS=30000}={}) {
 let child, timer, closed=false, ready=false, settle;
 const result=new Promise(resolve=>settle=resolve);
 const dispose=()=>{if(closed)return;closed=true;clearTimeout(timer);child?.terminate();child=null;settle(false);};
 try {
  child=createWorker();
  child.onmessage=({data})=>{
   if(closed)return;
   if(data?.type==='module-ready'){ready=true;clearTimeout(timer);settle(true);}
   else dispose();
  };
  child.onerror=child.onmessageerror=dispose;
  timer=setTimeout(dispose,timeoutMS);
  child.postMessage({type:'warm-module'});
 } catch {dispose();}
 return {ready:result,dispose,take(){
  if(closed||!ready)return null;
  const owned=child;child=null;closed=true;clearTimeout(timer);
  owned.onmessage=owned.onerror=owned.onmessageerror=null;
  return owned;
 }};
}
