// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
const [folder,output]=process.argv.slice(2);
if(!folder||!output)throw Error('Usage: node capture.mjs prepared-folder output.png');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'cel-render-'));
let server,browser,ws;
try{
 server=spawn('python3',['-u','-c','import http.server,functools,sys; s=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])); print(s.server_port,flush=True); s.serve_forever()',path.resolve(folder)],{stdio:['ignore','pipe','ignore']});
 const lines=readline.createInterface({input:server.stdout});
 const port=await new Promise((resolve,reject)=>{lines.once('line',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Server exited '+c)));});lines.close();
 browser=spawn(process.env.CHROMIUM||'chromium',['--headless','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
 let failure;browser.on('error',e=>failure=e);let debugPort;
 for(let i=0;i<200;i++){if(failure)throw failure;try{debugPort=(await fs.readFile(path.join(temp,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await pause(100);}
 if(!debugPort)throw Error('Chromium did not expose DevTools');
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const waiting=new Map();
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(waiting.has(d.id)){const [r,j]=waiting.get(d.id);waiting.delete(d.id);d.error?j(Error(JSON.stringify(d.error))):r(d.result);}};
 const call=(method,params={})=>new Promise((r,j)=>{const n=++id;waiting.set(n,[r,j]);ws.send(JSON.stringify({id:n,method,params}));});
 await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});

 await call('Runtime.enable');

 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const ready=async()=>{for(let i=0;i<2400;i++){await pause(100);const s=await evaluate("document.getElementById('status')?.textContent");if(s?.startsWith('Generation failed')||s?.includes('could not load')||s?.startsWith('Export failed'))throw Error(s);if(s?.startsWith('Geometry ready')&&await evaluate("document.documentElement.dataset.busy==='false'"))return;}throw Error('Geometry timeout');};
 const evidence={};
 for(const route of (process.env.GENERATOR_ROUTE?[process.env.GENERATOR_ROUTE]:['gridfinity-drawers','gridfinity-shelves'])){
  console.log('Checking '+route);
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/${route}/`});
  await ready();
  await evaluate(`window.__runtimeTestWorker=window.Worker;window.Worker=function(...args){const worker=new window.__runtimeTestWorker(...args);worker.addEventListener('message',event=>{if(window.cancelOnPackaging&&event.data.progress?.label?.startsWith('Packaging tile')){window.cancelOnPackaging=false;window.cancelSawBusy=document.documentElement.dataset.busy;document.getElementById('cancel').click();}});return worker;};`);
  if(route==='gridfinity-drawers'){
   await evaluate("for(const [k,v] of Object.entries({width:90,depth:90,columns:2,rows:2,tiling:'manual',cutsX:'45',cutsY:'45'}))document.querySelector('[name='+k+']').value=v;document.querySelector('[name=width]').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('generate').click()");await ready();
  }
  await evaluate("document.getElementById('viewer').scrollIntoView({block:'center'});window.exportBlobs=[];const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.exportBlobs.push({type:blob.type,size:blob.size});return original.call(this,blob)}");await pause(1000);
  const frame1=await evaluate("Number(document.getElementById('viewer').dataset.renderFrames)");await pause(1000);const frame2=await evaluate("Number(document.getElementById('viewer').dataset.renderFrames)");
  if(frame2!==frame1)throw Error(route+' viewer rendered while idle '+frame1+'→'+frame2);
  await evaluate("document.getElementById('"+(route==='gridfinity-drawers'?'print':'installed')+"').click()");await pause(1500);const frame3=await evaluate("Number(document.getElementById('viewer').dataset.renderFrames)");if(frame3<=frame2)throw Error('View change did not render');
  const before=await evaluate("document.getElementById('dimensions').textContent");
  await evaluate("document.getElementById('step').click();if(document.getElementById('cancel').disabled)throw Error('Export cancel disabled');document.getElementById('cancel').click()");await pause(700);
  if(!await evaluate("!document.getElementById('step').disabled && document.documentElement.dataset.busy==='false' && window.exportBlobs.length===0"))throw Error('Export cancellation lost model or downloaded stale result');
  await evaluate("document.getElementById('step').click()");await ready();
  if(!await evaluate("window.exportBlobs.some(b=>b.type==='application/step'&&b.size>1000)"))throw Error('STEP retry missing');
  if(route==='gridfinity-drawers'){
   const count=await evaluate('window.exportBlobs.length');
   await evaluate("window.cancelOnPackaging=true;document.getElementById('zip').click()");
   for(let i=0;i<100&&await evaluate('window.cancelOnPackaging');i++)await pause(50);
   if(!await evaluate("window.cancelSawBusy==='true'&&document.documentElement.dataset.lastTaskOutcome==='cancelled'&&!document.getElementById('step').disabled"))throw Error('In-flight ZIP cancellation failed '+JSON.stringify(await evaluate("({trigger:window.cancelOnPackaging,sawBusy:window.cancelSawBusy,outcome:document.documentElement.dataset.lastTaskOutcome,busy:document.documentElement.dataset.busy,stepDisabled:document.getElementById('step').disabled,status:document.getElementById('status').textContent})")));
   await pause(300);if(await evaluate('window.exportBlobs.length')!==count)throw Error('In-flight cancelled ZIP downloaded');
   await evaluate("document.getElementById('zip').click();if(document.documentElement.dataset.busy!=='true')throw Error('ZIP not busy');document.getElementById('cancel').click()");await pause(300);
   if(await evaluate('window.exportBlobs.length')!==count)throw Error('Cancelled ZIP downloaded');
   await evaluate("document.getElementById('zip').click()");await ready();
   if(!await evaluate("window.exportBlobs.at(-1).type==='application/zip'&&document.getElementById('status').textContent.includes('ZIP downloaded')&&document.documentElement.dataset.lastTaskOutcome==='success'"))throw Error('ZIP status/result missing');
  }
  const repeats=[];
  for(let i=0;i<3;i++){await evaluate("document.getElementById('generate').click()");await ready();repeats.push(await evaluate("({wallMS:Number(document.documentElement.dataset.lastTaskMS),dimensions:document.getElementById('dimensions').textContent})"));if(repeats.at(-1).dimensions!==before)throw Error('Repeated geometry metrics changed');}
  await evaluate("document.getElementById('step').click();dispatchEvent(new Event('pagehide'))");await pause(500);if(!await evaluate("document.documentElement.dataset.busy==='false'&&!document.getElementById('step').disabled"))throw Error('Pagehide did not recover');
  evidence[route]={idleFrames:frame2-frame1,viewUpdated:frame3>frame2,exportCancelRetry:true,pagehide:true,repeats,downloads:await evaluate('window.exportBlobs')};
 }
 await fs.writeFile(output,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{ws?.close();browser?.kill('SIGTERM');server?.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
