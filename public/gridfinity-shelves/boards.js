/** Board interfaces. SKADIS connector adapted from John Mylchreest, MIT.
 * See sources/skadis/LICENSE and board-sources.json. Coordinates: +Y toward shelf.
 */
export const boardDefaults={board_system:'original',board_thickness:5.5,slot_clearance:.2,board_gap:.2,retainer_depth:3};
export const boards={
 original:{name:'Original round-hole pegboard',pitchX:25.4,pitchZ:25.4,mode:'native'},
 skadis:{name:'IKEA SKÅDIS',pitchX:40,pitchZ:20,mode:'slotted',status:'Modeled from reference dimensions; not print tested.'}
};
export function checkBoard(p){
 if(!boards[p.board_system])throw Error('Choose a supported board system.');if(p.board_system==='original')return;
 for(const [k,a,b] of [['board_thickness',4,6.5],['slot_clearance',.1,.5],['board_gap',.1,.6],['retainer_depth',2,4]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(`${k}: use ${a} to ${b} mm.`);
}
export function boardLayout(p){
 if(p.board_system==='original')return null;
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
