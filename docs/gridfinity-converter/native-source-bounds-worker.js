import { computeNativeSourceBounds } from './native-cad.js?v=native-step-20261021-2';
self.onmessage=async({data})=>{
 const childStartedAtMS=performance.timeOrigin+performance.now();
 self.postMessage({type:'started',childStartedAtMS});
 try{const result=await computeNativeSourceBounds(data);self.postMessage({result,childStartedAtMS,childFinishedAtMS:performance.timeOrigin+performance.now()});}
 catch(error){self.postMessage({error:error.message,stack:error.stack,childStartedAtMS,childFinishedAtMS:performance.timeOrigin+performance.now()});}
 finally{self.close();}
};
