import fs from 'node:fs';import crypto from 'node:crypto';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,defaults} from '../../public/gridfinity-shelves/kernel.js';
import {footprintHull,bestPlacement} from '../../public/gridfinity-shelves/bed-placement.js';
const m=await Module();m.setup();const root=new URL('../../public/gridfinity-shelves/',import.meta.url),inputs=JSON.parse(fs.readFileSync(new URL('inputs.json',root)));
const config={...defaults};delete config.columns;delete config.base_type;
const hulls={};for(let columns=1;columns<=11;columns++){
 const r=build(m,inputs,{columns}),hull=footprintHull(r.vertices);hulls[columns]=hull;console.error('Precomputed',columns,'× 1',hull.length,'hull vertices');
}
const beds=[[180,180],[220,220],[250,210],[256,256],[300,300],[350,350]],commonBeds=[];
for(const [width,depth] of beds){let result={columns:0,rows:1};const upper=Math.min(11,Math.floor((Math.hypot(width,depth)-4+1e-6)/42));for(let columns=upper;columns>=1;columns--){const placement=bestPlacement(hulls[columns],width,depth);if(placement.fits){result={columns,rows:1,placement};break;}}commonBeds.push({width,depth,...result});}
const sources=Object.fromEntries(['kernel.js','base-options.js','boards.js','peg-fit.js','inputs.json','bed-placement.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex')]));
const record={revision:'base-controls-1',configuration:config,maxColumns:11,hulls,commonBeds,sources,scope:'Original board, one row, default geometry and fit settings, zero tilt. All floor/hardware choices have the same XY convex hull: additions stay inside the frame perimeter; pockets remove interior material. No other setting is normalized.'};
fs.writeFileSync(new URL('width-precomputed.json',root),JSON.stringify(record)+'\n');console.log(JSON.stringify(commonBeds,null,2));
