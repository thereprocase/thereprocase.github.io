import Module from './vendor/manifold.js';
import {build} from './kernel.js?v=frame-3';
const ready=Promise.all([Module().then(m=>{m.setup();return m;}),fetch('./inputs.json').then(r=>{if(!r.ok)throw Error('Could not load connector geometry');return r.json();})]);
self.onmessage=async({data})=>{try{const [module,inputs]=await ready,result=build(module,inputs,data);self.postMessage({result},[result.vertices.buffer,result.triangles.buffer]);}catch(e){self.postMessage({error:e.message});}};
