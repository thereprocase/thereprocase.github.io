import { computeNativeSourceBounds } from './native-cad.js?v=native-step-20261021-3';
self.onmessage=async({data})=>{
 if(data?.type==='warm-module'){self.postMessage({type:'module-ready'});return;}
 const childStartedAtMS=performance.timeOrigin+performance.now();
 self.postMessage({type:'started',childStartedAtMS});
 try{const result=await computeNativeSourceBounds(data);self.postMessage({result,childStartedAtMS,childFinishedAtMS:performance.timeOrigin+performance.now()});}
 catch(error){self.postMessage({error:error.message,stack:error.stack,childStartedAtMS,childFinishedAtMS:performance.timeOrigin+performance.now()});}
 finally{self.close();}
};
