// PRIVATE worker-result protocol: callers must obtain certificates only from the
// independent validator result, never imported metadata, report fields, or files.
// SHA binds bytes; it does not authenticate user-supplied metadata.
import { CERTIFICATE_BUILD } from './native-source-certificate-build.js?v=native-step-20261021-3';
export { CERTIFICATE_BUILD } from './native-source-certificate-build.js?v=native-step-20261021-3';
const SCHEMA = 2;
const hex = bytes => Array.from(new Uint8Array(bytes), x=>x.toString(16).padStart(2,'0')).join('');
const identity = pose => Array.isArray(pose?.rotation) && pose.rotation.length===9 && pose.rotation.every((x,i)=>x===[1,0,0,0,1,0,0,0,1][i]) && Array.isArray(pose?.translation) && pose.translation.length===3 && pose.translation.every(x=>x===0);
// Mirrors the export API's proper-rigid gate. Bounds are tied to coordinate pose,
// while source validity and signed volume are invariant under proper rigid motion.
export function properRigidPose(pose) {
  const r=pose?.rotation,t=pose?.translation;
  if(!Array.isArray(r)||r.length!==9||!Array.isArray(t)||t.length!==3||![...r,...t].every(Number.isFinite)) return false;
  for(let a=0;a<3;a++)for(let b=0;b<3;b++) {
    const dot=[0,1,2].reduce((v,c)=>v+r[a*3+c]*r[b*3+c],0);
    if(Math.abs(dot-(a===b?1:0))>1e-12)return false;
  }
  const det=r[0]*(r[4]*r[8]-r[5]*r[7])-r[1]*(r[3]*r[8]-r[5]*r[6])+r[2]*(r[3]*r[7]-r[4]*r[6]);
  return Math.abs(det-1)<=1e-12;
}
const validBounds = b => Array.isArray(b) && b.length===2 && b.every(row=>Array.isArray(row)&&row.length===3&&row.every(Number.isFinite)) && b[0].every((x,i)=>x<=b[1][i]);
export async function issueSourceCertificate({buffer,signedVolume,bounds,strictValid,solidCount}) {
  if(!(buffer instanceof ArrayBuffer) || !buffer.byteLength || strictValid!==true || solidCount!==1 || !Number.isFinite(signedVolume) || signedVolume<=0 || (bounds!==undefined && !validBounds(bounds))) throw Error('Cannot certify invalid source geometry.');
  const payload={schema:SCHEMA,build:CERTIFICATE_BUILD,format:'brep',method:'strict-reopened-single-solid',byteLength:buffer.byteLength,sha256:hex(await crypto.subtle.digest('SHA-256',buffer)),signedVolume,...(bounds===undefined ? {} : {bounds:bounds.map(row=>[...row])}),strictValid:true,solidCount:1};
  return payload;
}
export async function verifySourceCertificate({certificate,buffer,format,pose}) {
  // Every failure is a cache miss; caller retains the complete original checks.
  try {
    if(!properRigidPose(pose) || format!=='brep' || !(buffer instanceof ArrayBuffer)) return null;
    const p=certificate;
    if(!p || p.schema!==SCHEMA || p.build!==CERTIFICATE_BUILD || p.format!=='brep' || p.method!=='strict-reopened-single-solid' || p.byteLength!==buffer.byteLength || p.strictValid!==true || p.solidCount!==1 || !Number.isFinite(p.signedVolume) || p.signedVolume<=0 || (p.bounds!==undefined && !validBounds(p.bounds)) || !/^[a-f0-9]{64}$/.test(p.sha256)) return null;
    if(hex(await crypto.subtle.digest('SHA-256',buffer))!==p.sha256) return null;
    return {signedVolume:p.signedVolume,...(!identity(pose)||p.bounds===undefined ? {} : {bounds:p.bounds.map(row=>[...row])})};
  } catch { return null; }
}
