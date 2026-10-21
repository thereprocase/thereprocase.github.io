import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [folder,...inputs]=process.argv.slice(2);
if(!folder||inputs.length<4)throw Error('Usage: node generate-source-certificate-build.mjs CONVERTER_DIR issuer-threaded=relative.wasm issuer-single=relative.wasm verifier-threaded=relative.wasm verifier-single=relative.wasm');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifacts={};
for(const input of inputs.sort()){
 const split=input.indexOf('=');const role=input.slice(0,split),filename=input.slice(split+1);
 if(split<1||!filename||artifacts[role])throw Error('Invalid/duplicate artifact role: '+input);
 artifacts[role]={filename,sha256:sha(await readFile(path.resolve(folder,filename)))};
}
for(const role of ['issuer-threaded','issuer-single','verifier-threaded','verifier-single'])if(!artifacts[role])throw Error('Missing artifact role '+role);
const manifest={protocol:'strict-brep-source-certificate-v2',artifacts};
const fingerprint='native-certificate-kernel-set-sha256:'+sha(JSON.stringify(manifest));
await writeFile(path.join(folder,'native-source-certificate-build.js'),`// Generated from explicitly selected active issuer/verifier kernels.\n// Regenerate when any selected kernel or mapping changes.\nexport const CERTIFICATE_KERNEL_SET = Object.freeze(${JSON.stringify(manifest,null,2)});\nexport const CERTIFICATE_BUILD = ${JSON.stringify(fingerprint)};\n`);
console.log(JSON.stringify({fingerprint,...manifest},null,2));
