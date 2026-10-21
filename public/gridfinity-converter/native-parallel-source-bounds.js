import { BOUNDS_KERNELS } from './native-bounds-build.js?v=native-step-20261021-1';
import { properRigidPose } from './native-source-certificate.js?v=native-step-20261021-1';
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
export function startParallelSourceBounds({buffer,transform:pose},onProgress){
 let child,settled=false,timer,resolve;const started=performance.now();
 const result=new Promise(r=>resolve=r);
 const report=(...args)=>{try{onProgress(...args);}catch{/* Diagnostic observers cannot disrupt worker cleanup. */}};
 const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);child?.terminate();resolve(value);};
 try{
  child=new Worker(new URL('./native-source-bounds-worker.js?v=native-step-20261021-1',import.meta.url),{type:'module'});
  child.onmessage=({data})=>{const payload=data&&typeof data==='object'?data:{error:'Malformed bounds worker response'};try{report('Parallel source bounds finished…',{diagnostic:'parallel-source-bounds',...payload.result?.timings,capacityBytes:payload.result?.capacityBytes,error:payload.error,totalMS:performance.now()-started});}finally{finish(payload.result?{value:payload.result}:{error:payload.error||'Missing bounds result'});}};
  child.onerror=e=>finish({error:e.message||'Bounds worker failed'});child.onmessageerror=()=>finish({error:'Bounds worker response unreadable'});
  const copy=buffer.slice(0);child.postMessage({buffer:copy,pose},[copy]);
  timer=setTimeout(()=>finish({error:'Bounds worker timed out'}),120000);
  report('Computing source bounds in parallel…',{diagnostic:'parallel-source-bounds',stage:'start',inputBytes:buffer.byteLength});
 }catch(e){finish({error:e.message});}
 return {result,cancel:()=>finish({error:'Bounds task cancelled'})};
}
