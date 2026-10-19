import Module from '../gridfinity-shelves/vendor/manifold.js';
import {facetedSTEP} from '../gridfinity-shelves/solid-exports.js?v=drawer-qol-1';
self.onmessage=async({data})=>{try{const module=await Module();module.setup();const bytes=new TextEncoder().encode(facetedSTEP({parts:[{...data.tile,name:data.tile.name+'_PRINT'}]},module));self.postMessage({bytes},[bytes.buffer]);}catch(e){self.postMessage({error:e.message});}};
