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

 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Runtime.enable');await call('Page.enable');
 const evidence={};
 for(const route of ['gridfinity-drawers','gridfinity-shelves','gridfinity-converter']){
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/${route}/`});
  for(let i=0;i<1800;i++){await pause(100);const status=await evaluate("document.getElementById('status')?.textContent||''");if(/failed|could not load/i.test(status))throw Error(status);if(route==='gridfinity-converter'?await evaluate("document.getElementById('choose-file')?.disabled===false"):status.startsWith('Geometry ready'))break;if(i===1799)throw Error('startup timeout');}
  if(route==='gridfinity-converter'){await evaluate("document.getElementById('demo').click()");for(let i=0;i<1000;i++){await pause(100);if(await evaluate("document.body.dataset.busy!=='true'&&!document.getElementById('convert').disabled"))break;if(i===999)throw Error('demo timeout');}}
  evidence[route]=[];
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[390,844],[320,740]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await evaluate('scrollTo(0,0);document.getElementById("settings-panel").scrollTop=0');await pause(500);
   const selectors=route==='gridfinity-drawers'?['[name=width]','[name=depth]','[name=columns]','[name=rows]','#bed-preset','[name=bottom]','#generate','#stl','#step','#zip']:route==='gridfinity-shelves'?['[name=columns]','[name=rows]','[name=base_type]','[name=board_system]','#generate','#stl','#step','#three-mf']:['#choose-file','#style','#fit','#convert','#stl','#three-mf'];
   const record=await evaluate(`(()=>{const selectors=${JSON.stringify(selectors)};return {width:innerWidth,height:innerHeight,pageHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,viewer:(()=>{const r=document.getElementById('viewer').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}})(),controls:selectors.map(sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return {selector:sel,top:r.top,bottom:r.bottom,visible:!!el.getClientRects().length,inViewport:r.top>=0&&r.bottom<=innerHeight};})};})()`);
   evidence[route].push(record);if(record.overflow)throw Error(route+' horizontal overflow '+width);if(width>1000&&record.controls.some(c=>!c.inViewport||!c.visible))throw Error('BELOW FOLD '+route+' '+width+' '+JSON.stringify(record.controls.filter(c=>!c.inViewport||!c.visible)));
   const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+`-${route}-${width}.png`,Buffer.from(shot.data,'base64'));
  }
 }
 await fs.writeFile(output+'.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{ws?.close();browser?.kill();server?.kill();await pause(300);await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
