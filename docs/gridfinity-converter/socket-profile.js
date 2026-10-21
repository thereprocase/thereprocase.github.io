/** Female Gridfinity sockets: opening faces -Z in the aligned edit frame. */
export const SOCKET_STYLES={frame:'Open frame',plain:'Solid floor',magnets:'6 × 2 mm magnets',screws:'M3 screw holes',both:'Magnets + M3 screws',weighted:'Weighted'};
// Reverse of the generator's standard cavity, measured from the top rim.
// Positive fit tightens the socket by reducing its opening, per side.
export function socketSections(fit=0){return [[-.02,41.9,3.95],[0,41.9,3.95],[.2,41.1,3.55],[1.8,37.9,1.95],[3.6,37.9,1.95],[4.3,36.5,1.25],[5,36.5,1.25]].map(([z,w,r])=>[z,w-2*fit,r-fit]);}
export function socketPlan(p){
 const {style,feet,bottom,fit,magnetDepth,magnetDiameter,screwDiameter}=p;
 if(!Object.hasOwn(SOCKET_STYLES,style))throw Error('Choose a supported socket style.');
 const floor=style==='weighted'?6.4:['magnets','both'].includes(style)?Math.max(1.2,magnetDepth+.8):1.2;
 const depth=Math.max(p.height,5+floor), fills=[],cuts=[];
 for(const f of feet){
  const sx=f.sourceX??f.x,sy=f.sourceY??f.y;
  if(Math.hypot(sx-f.x,sy-f.y)>.1)throw Error('Socket centers differ from the fixed grid by more than 0.1 mm. Review the detected grid before replacing sockets.');
  fills.push({kind:'box',lo:[f.x-20.99,f.y-20.99,bottom],hi:[f.x+20.99,f.y+20.99,bottom+depth]});
  cuts.push({kind:'loft',x:f.x,y:f.y,sections:socketSections(fit).map(([z,w,r])=>[bottom+z,w,r])});
  if(style==='frame')cuts.push({kind:'box',lo:[f.x-16.25,f.y-16.25,bottom+4.99],hi:[f.x+16.25,f.y+16.25,bottom+depth+.02]});
  const magnets=['magnets','both','weighted'].includes(style),screws=['screws','both','weighted'].includes(style);
  for(const dx of [-13,13])for(const dy of [-13,13]){
   if(magnets)cuts.push({kind:'cylinder',x:f.x+dx,y:f.y+dy,z:bottom+4.99,height:magnetDepth+.01,radius:magnetDiameter/2});
   if(screws)cuts.push({kind:'cylinder',x:f.x+dx,y:f.y+dy,z:bottom+4.99,height:depth-5+.04,radius:screwDiameter/2});
   if(style==='weighted')cuts.push({kind:'cylinder',x:f.x+dx,y:f.y+dy,z:bottom+depth-3,height:3.02,radius:3});
  }
  if(style==='weighted'){
   cuts.push({kind:'box',lo:[f.x-10.7,f.y-10.7,bottom+depth-4],hi:[f.x+10.7,f.y+10.7,bottom+depth+.02]});
   for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
    const cx=f.x+12.125*dx,cy=f.y+12.125*dy;
    cuts.push({kind:'cylinder',x:cx,y:cy,z:bottom+depth-2.1,height:2.12,radius:4.25});
    const bx=f.x+10*dx,by=f.y+10*dy,hx=dx?2.125:4.25,hy=dy?2.125:4.25;
    cuts.push({kind:'box',lo:[bx-hx,by-hy,bottom+depth-2.1],hi:[bx+hx,by+hy,bottom+depth+.02]});
   }
  }
 }
 return {fills,cuts,depth,floor};
}
