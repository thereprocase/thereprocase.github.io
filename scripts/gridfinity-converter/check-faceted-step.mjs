import fs from 'node:fs';
import assert from 'node:assert/strict';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build} from '../../public/gridfinity-drawers/kernel.js';
import {facetedSTEP} from '../../public/gridfinity-shelves/solid-exports.js';
import {parseFacetedSTEP,isDirectFacetedSTEP} from '../../public/gridfinity-converter/faceted-step.js';
import {importSolid,detect,align,convert} from '../../public/gridfinity-converter/kernel.js';
const m=await Module();m.setup();const results=[];
for(const bottom of ['closed','open']){
 const tile=build(m,{width:90,depth:90,columns:2,rows:2,tiling:'none',bottom}).tiles[0];
 const input={parts:[{...tile,name:'Tile'}]},text=facetedSTEP(input,m);
 const parsed=parseFacetedSTEP(text),loaded=importSolid(m,parsed);
 assert.equal(loaded.bodies.length,1);
 const s=loaded.bodies[0],d=detect(m,s);assert.equal(d.interfaceType,'female');assert.equal(d.feet.length,4);
 const expected=input.stepNormalization[0].cadVolume;assert.ok(Math.abs(s.volume()-expected)<.01);
 const a=align(m,s,d);
 for(const style of ['frame','plain','magnets','screws','both','weighted']){
  const r=convert(m,a,{interfaceType:'female',feet:d.feet,style,height:6.2});assert.ok(r.report.outsideChange<.001);results.push({bottom,style,volume:s.volume(),expected,outsideChange:r.report.outsideChange});
 }
 fs.writeFileSync(`/tmp/faceted-${bottom}.step`,text);a.delete();s.delete();console.log(bottom,'PASS');
}
for(const path of process.argv.slice(2)){
 const start=performance.now(),p=parseFacetedSTEP(fs.readFileSync(path,'utf8')),loaded=importSolid(m,p);
 assert.equal(loaded.bodies.length,p.bodies.length);assert.equal(loaded.names[0],'Body_PRINT');
 const d=detect(m,loaded.bodies[0]);assert.equal(d.interfaceType,'female');
 const a=align(m,loaded.bodies[0],d),conversions=[];
 for(const style of ['frame','plain','magnets','screws','both','weighted']){
  const r=convert(m,a,{interfaceType:'female',feet:d.feet,style,height:6.2,bottom:d.bottom,fit:.02});assert.ok(r.report.outsideChange<.001);conversions.push({style,outsideChange:r.report.outsideChange});
 }a.delete();
 results.push({path,bodyNames:loaded.names,cells:d.feet.length,elapsedMS:performance.now()-start,conversions});loaded.bodies.forEach(b=>b.delete());console.log(path,'PASS');
}
assert.equal(isDirectFacetedSTEP("FACETED_BREP('x',#1); ADVANCED_FACE('',(),#2,.T.);"),false);
fs.writeFileSync('/tmp/faceted-step-checks.json',JSON.stringify(results,null,2));
