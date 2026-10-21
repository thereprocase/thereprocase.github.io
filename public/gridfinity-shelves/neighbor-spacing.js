import {boards} from './boards.js?v=dense-1';
import {parameters} from './kernel.js?v=magnet-fit-1';
/** Same-height repeats: preserve alternating slot/hex phases as well as hole pitch. */
export function horizontalSpacing(board,columns){
 const b=boards[board],p=parameters({board_system:board,columns,rows:1}),width=p.frameWidth;
 const repeatPitch=b.pitchX*(board==='hsw'?2:1),spacing=Math.ceil((width-1e-7)/repeatPitch)*repeatPitch;
 const top=Math.max(...p.mountSites.map(s=>s.z)),xs=p.mountSites.filter(s=>Math.abs(s.z-top)<1e-6).map(s=>s.x);
 const rowPitch=b.pitchX*(board==='hsw'?2:1),mountSpan=Math.max(...xs)-Math.min(...xs);
 return {columns,width,spacing,gap:spacing-width,holeSteps:Math.round(spacing/b.pitchX),emptyHoles:Math.max(0,Math.round((spacing-mountSpan)/rowPitch)-1)};
}
export function spacingForBed(board,bedWidth){return Array.from({length:32},(_,i)=>horizontalSpacing(board,i+1)).filter(r=>r.width<=bedWidth+1e-6);}
