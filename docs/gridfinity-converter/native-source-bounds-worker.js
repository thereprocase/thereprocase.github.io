import { computeNativeSourceBounds } from './native-cad.js?v=native-step-20261021-1';
self.onmessage=async({data})=>{try{const result=await computeNativeSourceBounds(data);self.postMessage({result});}catch(error){self.postMessage({error:error.message,stack:error.stack});}finally{self.close();}};
