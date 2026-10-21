import {parseFacetedSTEP} from './faceted-step.js?v=female-bases-20261021-3';
self.onmessage=({data})=>{
  try {
    self.postMessage({progress:'Indexing STEP polygon entities…'});
    const result=parseFacetedSTEP(new TextDecoder().decode(data.buffer),progress=>self.postMessage({progress}));
    const transfers=result.bodies.flatMap(b=>[b.vertices.buffer,b.triangles.buffer]);
    self.postMessage({result},transfers);
  }catch(error){self.postMessage({error:error.message});}
};
