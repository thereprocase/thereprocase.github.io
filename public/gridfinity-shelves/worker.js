import {reinforce} from './reinforcement.js?v=diagonal-1';
import Module from './vendor/manifold.js';
import {build,buildCoupon} from './kernel.js?v=diagonal-1';
const ready=Promise.all([Module().then(m=>{m.setup();return m;}),fetch('./inputs.json?v=backplate-4').then(r=>{if(!r.ok)throw Error('Could not load connector geometry');return r.json();})]);
let fitLibrary;
self.onmessage=async({data})=>{try{const [module,inputs]=await ready,p=data.parameters??data;if((!p.board_system||p.board_system==='original')&&(p.peg_clearance||p.hook_grip||p.hoop_firmness)){fitLibrary??=fetch('./fit-inputs.json?v=fit-7').then(r=>{if(!r.ok)throw Error('Could not load peg-fit geometry');return r.json();});inputs.fitLibrary=await fitLibrary;}const result=data.kind==='coupon'?buildCoupon(module,inputs,p):build(module,inputs,p);try{result.helpers=reinforce(module,inputs,result);}catch(e){result.reinforcementError=e.message;}self.postMessage({result},[result.vertices.buffer,result.triangles.buffer,...(result.helpers??[]).flatMap(h=>[h.vertices.buffer,h.triangles.buffer])]);}catch(e){self.postMessage({error:e.message});}};
