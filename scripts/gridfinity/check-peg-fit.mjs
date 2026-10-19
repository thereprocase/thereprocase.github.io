import fs from 'node:fs';import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {buildCoupon,parameters,binarySTL} from '../../public/gridfinity-shelves/kernel.js';
import {makePegs} from '../../public/gridfinity-shelves/peg-fit.js';
const out=process.argv[2]||'/tmp/gridfinity-peg-fit';fs.mkdirSync(out,{recursive:true});
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));inputs.fitLibrary=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/fit-inputs.json',import.meta.url)));
const data=[];for(const p of [{},{peg_clearance:.15},{peg_clearance:-.15},{hook_grip:.2},{hook_grip:-.2},{hoop_firmness:.2},{hoop_firmness:-.15},{peg_clearance:.15,hook_grip:.2,hoop_firmness:-.15},{peg_clearance:-.15,hook_grip:-.2,hoop_firmness:.2},{peg_clearance:.05,hook_grip:.05,hoop_firmness:.05}]){
 const r=buildCoupon(m,inputs,p);assert(r.pegDelta<.01);const solid=new m.Manifold(new m.Mesh({numProp:3,vertProperties:r.vertices,triVerts:r.triangles}));const parts=solid.decompose();assert.equal(parts.length,1);parts.forEach(x=>x.delete());solid.delete();data.push({parameters:p,volume:r.volume,pegDifference:r.pegDelta,triangles:r.trianglesCount,pass:true});if(Object.keys(p).length===0||p.peg_clearance===.05)fs.writeFileSync(out+'/'+(p.peg_clearance?'tuned':'default')+'-coupon.stl',new Uint8Array(binarySTL(r)));
}
function pegs(p){const all=[],keep=o=>(all.push(o),o),r=makePegs(m,inputs,parameters(p),keep);return {r,close:()=>{for(let i=all.length-1;i>=0;i--)all[i].delete();}};}
function difference(a,b){const ab=a.subtract(b),ba=b.subtract(a),v=ab.volume()+ba.volume();ab.delete();ba.delete();return v;}
const base=pegs({}),grip=pegs({hook_grip:.1}),hoop=pegs({hoop_firmness:.1}),loose=pegs({peg_clearance:.1});assert(difference(base.r.lower,grip.r.lower)<1e-8);assert(difference(base.r.upper,hoop.r.upper)<1e-8);
const measured=[];for(const [label,group] of [['zero',base],['looser',loose]]){const row={label};for(const which of ['upper','lower']){const slab=m.Manifold.cube([20,.02,.02]).translate([-10,-.51,.11]),section=group.r[which].intersect(slab),b=section.boundingBox();row[which]=b.max[0]-b.min[0];section.delete();slab.delete();}measured.push(row);}assert(Math.abs(measured[0].upper-measured[1].upper-.2)<.0001);assert(Math.abs(measured[0].lower-measured[1].lower-.2)<.0001);
const rear=m.Manifold.cube([20,20,20]).translate([-10,-23.85,-10]);for(const which of ['upper','lower']){const a=base.r[which].intersect(rear),b=loose.r[which].intersect(rear);assert(difference(a,b)<.005,'Hole clearance changed rear hook/hoop');a.delete();b.delete();}rear.delete();
for(const g of [base,grip,hoop,loose])g.close();
for(const p of [{peg_clearance:.2},{hook_grip:.25},{hoop_firmness:-.2},{peg_clearance:.01},{hook_grip:NaN}])assert.throws(()=>parameters(p));
const report={couponCases:data,measuredCrushRibWidths:measured,upperGripLeavesLowerUnchanged:true,lowerFirmnessLeavesUpperUnchanged:true,holeClearanceLeavesRearHooksAndHoopsUnchanged:true,pitch:25.4,invalidCases:5};fs.writeFileSync(out+'/peg-fit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
