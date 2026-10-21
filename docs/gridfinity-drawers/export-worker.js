import Module from '../gridfinity-shelves/vendor/manifold.js';
import {facetedSTEP} from '../gridfinity-shelves/solid-exports.js?v=drawer-qol-1';
import {binarySTL} from './kernel.js?v=runtime-3';
import {zip} from './zip.js';
self.onmessage=async({data})=>{try{
 let bytes;
 if(data.format==='zip'){
  const entries=data.tiles.map((tile,i)=>{self.postMessage({progress:{label:`Packaging tile ${i+1} of ${data.tiles.length}`,completed:i+1,total:data.tiles.length}});return [`${data.stem}-${tile.name}.stl`,binarySTL(tile)];});
  bytes=new Uint8Array(await zip([...entries,['recipe.json',data.recipe],['ASSEMBLY.txt',data.notes]]).arrayBuffer());
 }else{
  self.postMessage({progress:{label:'Loading STEP geometry engine'}});const module=await Module();module.setup();self.postMessage({progress:{label:'Validating and writing faceted STEP'}});
  bytes=new TextEncoder().encode(facetedSTEP({parts:[{...data.tile,name:data.tile.name+'_PRINT'}]},module));
 }
 self.postMessage({bytes},[bytes.buffer]);
}catch(e){self.postMessage({error:e.message});}};
