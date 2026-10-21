import Module from '../gridfinity-shelves/vendor/manifold.js';
import {build} from './kernel.js?v=drawer-bases-2';
const ready=Module().then(m=>{m.setup();return m;});
self.onmessage=async({data})=>{try{self.postMessage({progress:{label:'Loading geometry engine'}});const module=await ready;self.postMessage({progress:{label:'Building seats and tile boundaries'}});const result=build(module,data,progress=>self.postMessage({progress}));self.postMessage({result},result.tiles.flatMap(t=>[t.vertices.buffer,t.triangles.buffer]));}catch(e){self.postMessage({error:e.message});}};
