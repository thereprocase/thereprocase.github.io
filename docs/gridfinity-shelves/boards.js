/** Board interfaces. SKADIS connector adapted from John Mylchreest, MIT.
 * See sources/skadis/LICENSE and board-sources.json. Coordinates: +Y toward shelf.
 */
export const boardDefaults={board_system:'original',board_thickness:5.5,slot_clearance:.2,board_gap:.2,retainer_depth:3,hole_diameter:7.14375,lower_clearance:.2,screw_clearance:.2,head_clearance:.35,counterbore_depth:3.2};
export const boards={
 original:{name:'Original round-hole pegboard',pitchX:25.4,pitchZ:25.4,mode:'native'},
 skadis:{name:'IKEA SKÅDIS',pitchX:40,pitchZ:20,mode:'slotted',status:'Modeled from reference dimensions; not print tested.'},
 us_small:{name:'US small-hole pegboard · 3/16 in holes',pitchX:25.4,pitchZ:25.4,mode:'round',hole:4.7625,thickness:3.2},
 us_large:{name:'US large-hole pegboard · 9/32 in holes',pitchX:25.4,pitchZ:25.4,mode:'round',hole:7.14375,thickness:5.5},
 wall_control:{name:'Wall Control · round holes',pitchX:25.4,pitchZ:25.4,mode:'round',hole:6.35,thickness:.9},
 metric25:{name:'Metric round-hole · 25 mm grid',pitchX:25,pitchZ:25,mode:'round',hole:6,thickness:5},
 bott_perfo:{name:'Bott Perfo · 9.2 mm square holes',pitchX:38.1,pitchZ:38.1,mode:'square',hole:9.2,thickness:.9},
 multiboard:{name:'Multiboard · M3 nut snaps',pitchX:25,pitchZ:25,mode:'bolted',insert:'https://thangs.com/designer/MultiBuild/3d-model/Drop-In%20Nut%20Snap%20-%20M3-1030686'},
 hsw:{name:'Honeycomb Storage Wall · M3 inserts',pitchX:23.6*Math.sqrt(3),pitchZ:23.6,mode:'bolted',insert:'https://www.printables.com/model/152592-honeycomb-storage-wall'}
};
export function boardSettings(id){const b=boards[id];return {...boardDefaults,board_system:id,...(b?.hole?{hole_diameter:b.hole,board_thickness:b.thickness}:{})};}
export function checkBoard(p){
 if(!boards[p.board_system])throw Error('Choose a supported board system.');if(p.board_system==='original')return;if(boards[p.board_system].mode==='bolted'){for(const [k,a,b] of [['screw_clearance',.1,.4],['head_clearance',.1,.5],['counterbore_depth',3.1,3.4]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(`${k}: use ${a} to ${b} mm.`);return;}
 const slotted=boards[p.board_system].mode==='slotted';for(const [k,a,b] of [['board_thickness',slotted?4:.5,slotted?6.5:8],['slot_clearance',.1,.5],['board_gap',.1,.6],...(slotted?[['retainer_depth',2,4]]:[['hole_diameter',4,10],['lower_clearance',.1,.5]])])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(`${k}: use ${a} to ${b} mm.`);
}
export function boardLayout(p){
 if(p.board_system==='original')return null;
 if(p.board_system!=='skadis'){const b=boards[p.board_system],w=42*p.columns+4,count=Math.floor((w-10)/b.pitchX)+1,all=Array.from({length:count},(_,i)=>(i-(count-1)/2)*b.pitchX),every=Math.max(1,Math.floor(80/b.pitchX)),xs=all.filter((_,i)=>i%every===0);if(xs.at(-1)!==all.at(-1))xs.push(all.at(-1));const zs=Array.from({length:p.mount_rows},(_,i)=>-b.pitchZ*i);return {mountSites:xs.flatMap(x=>zs.map((z,row)=>({x,z,row}))),mountZ:zs,mounts:xs,width:w,backBottom:p.mount_rows===1?-12.7:zs.at(-1)-5,boardPitchX:b.pitchX,boardPitchZ:b.pitchZ};}
 const w=42*p.columns+4,limit=w/2-5,baseCount=Math.floor(2*limit/40)+1,phase=(baseCount-1)*20%40;
 const sites=[],rowZ=[];let row=0;
 for(let j=0;j<p.mount_rows;j++){
  let xs;
  do{const offset=(phase+20*(row%2))%40;xs=[];for(let n=-20;n<=20;n++){const x=40*n+offset;if(Math.abs(x)<=limit+1e-8)xs.push(x);}if(!xs.length)row++;}while(!xs.length);
  // At most 80 mm between columns, always retain both outside mounts.
  const selected=xs.filter((_,i)=>i%2===0);if(selected.at(-1)!==xs.at(-1))selected.push(xs.at(-1));
  for(const x of selected)sites.push({x,z:-20*row,row:j});rowZ.push(-20*row);row++;
 }
 const xs=[...new Set(sites.map(s=>s.x))].sort((a,b)=>a-b);
 return {mountSites:sites,mountZ:rowZ,mounts:xs,width:w,backBottom:rowZ.at(-1)-17.5,boardPitchX:40,boardPitchZ:20};
}
export function skadisDimensions(p){
 const width=5-2*p.slot_clearance;
 // The source library uses a rectangular-slot bottom. Raise its tab to clear
 // the actual R2.5 slot ends, including the full leading-edge envelope.
 const tabBottom=-5-Math.sqrt(2.5**2-(width/2)**2)+.02,tabTop=tabBottom+5;
 const tailBottom=tabTop-11.5,insertLift=-5.25-tailBottom;
 return {width,tabBottom,tabTop,tailBottom,insertLift,grip:p.board_thickness+p.board_gap};
}
export function makeBoardPegs(module,p,keep){
 if(boards[p.board_system].mode==='bolted')return makeBoltedPegs(module,p,keep);
 if(p.board_system!=='skadis')return makeRoundPegs(module,p,keep);
 const {Manifold:M,Mesh}=module,d=skadisDimensions(p),face=Math.fround(.15);
 const box=(s,v)=>keep(keep(M.cube(s)).translate(v));
 function taperedTab(){
  const a=-d.width/2,b=d.width/2,y0=face-d.grip-p.retainer_depth,y1=face+2,z0=d.tabBottom,z1=d.tabTop,c=.3;
  const v=[[a,y0,z0],[b,y0,z0],[b,y1,z0],[a,y1,z0],[a+c,y0+c,z1],[b-c,y0+c,z1],[b-c,y1,z1],[a+c,y1,z1]];
  const t=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  return keep(new M(new Mesh({numProp:3,vertProperties:new Float32Array(v.flat()),triVerts:new Uint32Array(t.flat())})));
 }
 const tail=box([d.width,p.retainer_depth,6.6],[-d.width/2,face-d.grip-p.retainer_depth,d.tailBottom]);
 const root=box([10,5.4,15],[-5,face,d.tabTop-15]);
 const hook=keep(M.union([root,taperedTab(),tail]));
 if(hook.status()!=='NoError')throw Error('SKÅDIS hook construction failed.');
 return {upper:hook,lower:hook,locator:hook,dimensions:d,root:{width:10,height:15,bottom:d.tabTop-15}};
}

/** Round L-pin and locating peg adapted from Eugene Vasenev / mrvarity, MIT.
 * Only local pin/board dimensions change; Gridfinity seats are never scaled.
 * See sources/round/LICENSE. Bott uses the same rounded pin inside a square hole.
 */
export function roundDimensions(p){
 const diameter=p.hole_diameter-2*p.slot_clearance,lowerDiameter=p.hole_diameter-2*p.lower_clearance;
 return {diameter,lowerDiameter,width:diameter-.8,lowerWidth:lowerDiameter-.8,grip:p.board_thickness+p.board_gap,rise:7};
}
function makeRoundPegs(module,p,keep){
 const {Manifold:M}=module,d=roundDimensions(p),face=Math.fround(.15),r=d.diameter/2,lr=d.lowerDiameter/2,elbow=face-d.grip-r;
 const move=(s,v)=>keep(s.translate(v)),box=(s,v)=>move(keep(M.cube(s)),v),sphere=(v)=>move(keep(M.sphere(r,48)),v);
 const cylinder=(radius,length,start)=>move(keep(keep(M.cylinder(length,radius,radius,48)).rotate([90,0,0])),start);
 const joint=sphere([0,elbow,0]),tip=sphere([0,elbow,d.rise]),front=cylinder(r,.02,[0,face+2,0]);
 const raw=keep(M.union([keep(M.hull([front,joint])),keep(M.hull([joint,tip]))]));
 const upper=keep(raw.intersect(box([d.width,60,40],[-d.width/2,-40,-10])));
 const length=d.grip+2.5,body=cylinder(lr,length+2-.8+.05,[0,face+2,0]),nose=move(keep(keep(M.cylinder(.8,lr,Math.max(.3,lr-.6),48)).rotate([90,0,0])),[0,face-length+.8,0]);
 const lower=keep(keep(M.union([body,nose])).intersect(box([d.lowerWidth,60,30],[-d.lowerWidth/2,-40,-15])));
 const root=box([10,5.4,10],[-5,face,-5]),withRoot=s=>keep(M.union([root,s]));
 const up=withRoot(upper),low=withRoot(lower);if(up.status()!=='NoError'||low.status()!=='NoError')throw Error('Round-hole connector construction failed.');
 return {upper:up,lower:low,locator:low,dimensions:d,root:{width:10,height:10,bottom:-5}};
}

/** Original screw interface: existing M3 inserts supply the board-side snap fit.
 * No Multiboard or HSW connector mesh is bundled or modified here.
 */
function makeBoltedPegs(module,p,keep){
 const {Manifold:M}=module,face=Math.fround(.15),box=keep(keep(M.cube([10,5.4,10])).translate([-5,face,-5]));
 function cuts(x=0,z=0){
  const cyl=(r,h,y)=>keep(keep(keep(M.cylinder(h,r,r,64)).rotate([90,0,0])).translate([x,y,z]));
  // Keep the screw head and short Allen-key approach clear through gussets.
  const approach=10;
  return [cyl(1.5+p.screw_clearance,7,face+6),cyl(2.75+p.head_clearance,p.counterbore_depth+.01+approach,face+5.41+approach)];
 }
 const root=keep(box.subtract(keep(M.union(cuts()))));
 return {upper:root,lower:root,locator:root,root:{width:10,height:10,bottom:-5},cuts,mode:'bolted'};
}
