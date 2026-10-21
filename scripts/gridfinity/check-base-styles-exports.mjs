import fs from 'node:fs';
import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build} from '../../public/gridfinity-shelves/kernel.js';
import {reinforce} from '../../public/gridfinity-shelves/reinforcement.js';
import {facetedSTEP,modifier3MF} from '../../public/gridfinity-shelves/solid-exports.js';
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url))),out=process.argv[2]||'/tmp/new-base-exports',evidence=[];fs.mkdirSync(out,{recursive:true});
for(const base_type of ['plain','magnets','screws','both']){
 const r=build(m,inputs,{base_type});r.helpers=reinforce(m,inputs,r);assert.ok(r.helpers.length);
 const step=facetedSTEP(r,m),threeMF=modifier3MF(r);assert.ok(step.includes('END-ISO-10303-21;'));assert.ok(threeMF.byteLength>100);
 fs.writeFileSync(out+'/'+base_type+'.step',step);fs.writeFileSync(out+'/'+base_type+'.3mf',Buffer.from(threeMF));
 evidence.push({base_type,volume:r.volume,helpers:r.helpers.length,stepBytes:step.length,threeMFBytes:threeMF.byteLength,stepNormalization:r.stepNormalization});console.log(base_type,'PASS');
}
fs.writeFileSync(out+'/checks.json',JSON.stringify(evidence,null,2));
