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
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/gridfinity-shelves/`});const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const ready=async()=>{for(let i=0;i<1800;i++){await pause(100);const s=await evaluate("document.getElementById('status')?.textContent");if(s?.startsWith('Generation failed')||s?.includes('could not load'))throw Error(s);if(s?.startsWith('Geometry ready'))return;}throw Error('Geometry timeout');};
 await ready();
 const results={};
 await evaluate("document.querySelector('[name=base_type]').value='weighted';document.querySelector('[name=base_type]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-preset=\"11\"]').click()");await ready();
 results.presetPreservesBase=await evaluate("document.querySelector('[name=base_type]').value==='weighted'&&document.getElementById('dimensions').innerText.includes('Weighted')");
 await evaluate("document.getElementById('share-settings').click()");await pause(500);
 const link=await evaluate("document.getElementById('share-url').value");
 await call('Page.navigate',{url:link});await ready();
 results.settingsRestored=await evaluate("document.querySelector('[name=base_type]').value==='weighted'&&document.querySelector('[name=columns]').value==='1'&&document.getElementById('share-status').textContent.includes('restored')");
 results.reinforcement=await evaluate("!document.getElementById('step').disabled&&!document.getElementById('three-mf').disabled");
 for(const width of [320,390,1600]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await pause(200);results['layout'+width]=await evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('[name=base_type]').getBoundingClientRect().width>140");}
 await evaluate("document.getElementById('installed').click();document.getElementById('viewer').scrollIntoView({block:'center'})");await pause(300);
 const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output,Buffer.from(shot.data,'base64'));
 await fs.writeFile(output+'.json',JSON.stringify(results,null,2)+'\n');
 if(Object.values(results).some(v=>!v))throw Error(JSON.stringify(results));console.log(results);
}finally{ws?.close();browser?.kill();server?.kill();await pause(200);await fs.rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
