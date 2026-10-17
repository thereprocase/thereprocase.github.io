import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import {build,binarySTL,parameters} from '../../public/gridfinity-shelves/kernel.js';
import fs from 'node:fs';
const m=await Module();m.setup();const inputs=JSON.parse(fs.readFileSync(new URL('../../public/gridfinity-shelves/inputs.json',import.meta.url)));
const cases=[['11',{columns:1,beam:5},11108.493793412219],['21',{},15846.31437583762],['22',{rows:2},22246.94917208197],['41',{columns:4},27052.873862119202],['tight',{columns:1,clearance:-.1,web:6,beam:20},16714.55900656621],['up',{rows:2,angle:5},23090.29247693433],['down',{rows:2,angle:-30},20014.02103925417]];
const out=process.argv[2]||'/tmp/gridfinity-kernel-checks';fs.mkdirSync(out,{recursive:true});const evidence=[];
for(const [name,p,native] of cases){const r=build(m,inputs,p),error=Math.abs(r.volume-native)/native;if(error>.0001)throw Error('Native volume mismatch '+name);const b=binarySTL(r);fs.writeFileSync(`${out}/${name}.stl`,Buffer.from(b));
 const edges=new Map();for(let i=0;i<r.triangles.length;i+=3)for(let j=0;j<3;j++){const a=r.triangles[i+j],b=r.triangles[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const old=edges.get(key)||[0,0];edges.set(key,[old[0]+1,old[1]+(a<b?1:-1)]);}if([...edges.values()].some(([n,w])=>n!==2||w!==0))throw Error('Edge incidence/winding failed '+name);
 if([...r.vertices].some((v,i)=>!Number.isFinite(v)||(i%3===2&&v<-.00001)))throw Error('Invalid print coordinates');
 evidence.push({name,parameters:p,nativeVolume:native,browserVolume:r.volume,relativeVolumeError:error,pegDifference:r.pegDelta,footOverlap:r.footOverlap,triangles:r.trianglesCount,pairedEdgesAndWinding:true});console.log(name+' PASS');}
for(const p of [{columns:0},{rows:1.5},{columns:12,rows:12},{angle:6},{angle:-31},{web:1},{beam:21},{clearance:.3},{unknown:1}]){let failed=false;try{parameters(p);}catch{failed=true;}if(!failed)throw Error('Invalid parameters accepted');}
fs.writeFileSync(`${out}/CHECKS.json`,JSON.stringify(evidence,null,2)+'\n');
