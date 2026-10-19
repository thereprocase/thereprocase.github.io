import assert from 'node:assert/strict';
import {boards} from '../../public/gridfinity-shelves/boards.js';
import {horizontalSpacing,spacingForBed} from '../../public/gridfinity-shelves/neighbor-spacing.js';
for(const [id,b] of Object.entries(boards))for(let c=1;c<=32;c++){
 const r=horizontalSpacing(id,c),pitch=b.pitchX*(id==='hsw'?2:1);
 assert(r.spacing>=r.width-1e-6);assert(r.spacing-pitch<r.width);
 assert(Math.abs(r.spacing/pitch-Math.round(r.spacing/pitch))<1e-6);
 assert(Number.isInteger(r.emptyHoles)&&r.emptyHoles>=0);
}
assert.deepEqual([1,2,3,4].map(c=>+horizontalSpacing('original',c).gap.toFixed(1)),[4.8,13.6,22.4,5.8]);
for(const id of Object.keys(boards)){
 assert.equal(spacingForBed(id,256).length,6);assert.equal(spacingForBed(id,255).length,5);
 assert.equal(spacingForBed(id,2000).length,32);assert.equal(spacingForBed(id,25).length,0);
}
assert.equal(horizontalSpacing('hsw',1).emptyHoles,1);
console.log('288 board/width cases, stagger phase, known gaps and bed limits: PASS');
