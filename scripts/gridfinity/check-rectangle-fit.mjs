import assert from 'node:assert/strict';
import {footprintHull,bestPlacement,placementAtAngle} from '../../public/gridfinity-shelves/bed-placement.js';
const hull=points=>footprintHull(points.flatMap(([x,y])=>[x,y,0]));
const rotate=(points,angle)=>points.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)]);
const rectangle=[[0,0],[140,0],[140,37],[0,37]];
const rotated=hull(rotate(rectangle,.31741));
const exact=bestPlacement(rotated,140,37);
assert(exact.fits);assert(Math.abs(exact.score-1)<1e-12);assert(exact.angle>90);
assert(!bestPlacement(rotated,139.99,36.99).fits);
assert.equal(bestPlacement(hull([[0,0]]),100,100).score,0);
assert(Math.abs(bestPlacement(hull([[0,0],[200,0]]),100,100).angle-45)<1e-9);
assert.throws(()=>bestPlacement([],100,100));assert.throws(()=>bestPlacement([[NaN,0]],100,100));
const concave=[[0,0],[140,0],[140,37],[80,37],[80,12],[50,12],[50,37],[0,37]];
assert.deepEqual(hull(concave),hull(rectangle));
assert.deepEqual(bestPlacement(hull([...concave,[10,10],[20,10],[20,20]]),110,90),bestPlacement(hull(rectangle),110,90));
let seed=912317;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let maxGap=0,maxCandidates=0;
for(let test=0;test<150;test++){
 const points=Array.from({length:3+Math.floor(random()*35)},()=>[(random()-.5)*300,(random()-.5)*150]);
 const h=hull(points),w=20+random()*300,d=20+random()*300,p=bestPlacement(h,w,d);
 let sampled=Infinity;
 for(let i=0;i<36000;i++)sampled=Math.min(sampled,placementAtAngle(h,w,d,i/200).score);
 assert(p.score<=sampled+1e-11,`Missed optimum on case ${test}`);
 maxGap=Math.max(maxGap,sampled-p.score);maxCandidates=Math.max(maxCandidates,p.candidates);
 // Independent all-point bounds and translation, including points removed by the hull.
 const transformed=points.map(([x,y])=>[p.c*x-p.s*y+p.x,p.s*x+p.c*y+p.y]);
 const xs=transformed.map(p=>p[0]),ys=transformed.map(p=>p[1]);
 assert(Math.abs(Math.max(...xs)-Math.min(...xs)-p.width)<1e-9);
 assert(Math.abs(Math.max(...ys)-Math.min(...ys)-p.depth)<1e-9);
 assert(Math.abs(Math.max(...xs)+Math.min(...xs)-w)<1e-9);
 assert(Math.abs(Math.max(...ys)+Math.min(...ys)-d)<1e-9);
}
console.log(JSON.stringify({pass:true,randomCases:150,oracleAnglesPerCase:36000,maxGap,maxCandidates,rotatedTightFit:exact},null,2));
