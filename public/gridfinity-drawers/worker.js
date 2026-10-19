import Module from '../gridfinity-shelves/vendor/manifold.js';
import {build} from './kernel.js?v=fit-relief-1';
const ready=Module().then(m=>{m.setup();return m;});
self.onmessage=async({data})=>{try{const result=build(await ready,data);self.postMessage({result},result.tiles.flatMap(t=>[t.vertices.buffer,t.triangles.buffer]));}catch(e){self.postMessage({error:e.message});}};
