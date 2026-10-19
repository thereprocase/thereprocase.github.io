import Module from './vendor/manifold.js';
import {facetedSTEP,modifier3MF} from './solid-exports.js?v=reinforce-1';
self.onmessage=async({data})=>{try{let module;if(data.format==='step'){module=await Module();module.setup();}const bytes=data.format==='step'?new TextEncoder().encode(facetedSTEP(data.result,module)):modifier3MF(data.result);self.postMessage({bytes},[bytes.buffer]);}catch(e){self.postMessage({error:e.message});}};
