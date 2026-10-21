// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
const [folder, output] = process.argv.slice(2);
if (!folder || !output)
  throw Error('Usage: node check-native-export-pagehide-browser.mjs public-folder output.json');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cel-render-'));
let server, browser, ws;
try {
  server=spawn('python3',['-u','-c',
    'import http.server,sys,functools\nclass H(http.server.SimpleHTTPRequestHandler):\n def end_headers(self):\n  self.send_header("Cross-Origin-Opener-Policy","same-origin");self.send_header("Cross-Origin-Embedder-Policy","require-corp");super().end_headers()\ns=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(H,directory=sys.argv[1]));print(s.server_port,flush=True);s.serve_forever()',
    path.resolve(folder)],{stdio:['ignore','pipe','ignore']});
  const lines = readline.createInterface({ input: server.stdout });
  const port = await new Promise((resolve, reject) => {
    lines.once('line', resolve);
    server.once('error', reject);
    server.once('exit', (c) => reject(Error('Server exited ' + c)));
  });
  lines.close();
  browser = spawn(
    process.env.CHROMIUM || 'chromium',
    [
      '--headless',
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      '--user-data-dir=' + temp,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let failure;
  browser.on('error', (e) => (failure = e));
  let debugPort;
  for (let i = 0; i < 200; i++) {
    if (failure) throw failure;
    try {
      debugPort = (
        await fs.readFile(path.join(temp, 'DevToolsActivePort'), 'utf8')
      ).split('\n')[0];
      break;
    } catch {}
    await pause(100);
  }
  if (!debugPort) throw Error('Chromium did not expose DevTools');
  const tab = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if(d.method==='Runtime.consoleAPICalled') console.log(...d.params.args.map(a=>a.value));
    if (waiting.has(d.id)) {
      const [r, j] = waiting.get(d.id);
      waiting.delete(d.id);
      if (d.error) j(Error(JSON.stringify(d.error)));
      else r(d.result);
    }
  };
  const call = (method, params = {}) =>
    new Promise((r, j) => {
      const n = ++id;
      waiting.set(n, [r, j]);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Target.setDiscoverTargets',{discover:true});
  await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.exportAudit=[];const RealWorker=Worker;let seq=0;
    window.Worker=class extends RealWorker{
      constructor(url,options){super(url,options);this.auditId=++seq;this.exportWorker=String(url).includes('native-export-worker');
        this.addEventListener('message',({data})=>{if(this.exportWorker&&window.hideOnExport&&data.progress){window.hideOnExport=false;window.exportAudit.push({event:'pagehide',id:this.auditId});dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));}});
        if(this.exportWorker)window.exportAudit.push({event:'start',id:this.auditId});
      }
      terminate(){if(this.exportWorker)window.exportAudit.push({event:'terminate',id:this.auditId});return super.terminate();}
    };`});
  await call('Page.navigate', {
    url: `http://127.0.0.1:${port}/gridfinity-converter/`,
  });
  const evaluate = async (expression) => {
    const r = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  const ready=async()=>{for(let i=0;i<1000;i++){await pause(100);let state;try{state=await evaluate("({busy:document.body?.dataset.busy,status:document.getElementById('status')?.textContent})");}catch(error){if(/context|target navigated/.test(error.message))continue;throw error;}if(state.busy==='false')return state;}throw Error('UI timeout');};
  await ready();
  const downloads=await fs.mkdtemp('/tmp/native-pagehide-downloads-');await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const doc=await call('DOM.getDocument');const input=await call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#files'});
  const fixture=process.env.AUDIT_NATIVE_FIXTURE || path.resolve(folder,'converter-test-fixtures/native.step');
  await fs.access(fixture);
  await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
  await ready();await evaluate("document.getElementById('style').value='magnets';document.getElementById('convert').click()");await ready();
  await pause(1000);
  const before=await call('Target.getTargets');
  const roots=before.targetInfos.filter(t=>t.url.includes('native-export-worker')).map(t=>t.targetId);
  await evaluate("window.hideOnExport=true;document.getElementById('translate-step').click()");
  const cancelled=await ready();
  const cleanup=[];let remaining=[];
  for(let i=0;i<50;i++){await pause(100);const infos=(await call('Target.getTargets')).targetInfos;const owned=new Set(roots);let changed=true;while(changed){changed=false;for(const t of infos){if(owned.has(t.parentId)&&!owned.has(t.targetId)){owned.add(t.targetId);changed=true;}}}remaining=infos.filter(t=>owned.has(t.targetId));cleanup.push(remaining.length);if(!remaining.length)break;}
  const retryState=await evaluate("({stepEnabled:!document.getElementById('translate-step').disabled,style:document.getElementById('style').value,audit:window.exportAudit})");
  await evaluate("document.getElementById('translate-step').click()");const retried=await ready();
  await pause(200);const files=await fs.readdir(downloads);
  const result={roots,cancelled,retryState,retried,cleanup,remaining,files,downloads};
  if(!roots.length||remaining.length||cancelled.busy!=='false'||!retryState.stepEnabled||retryState.style!=='magnets'||!retryState.audit.some(x=>x.event==='pagehide')||!files.some(x=>x.endsWith('.step')))throw Error('Pagehide retry failed '+JSON.stringify(result));
  await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();browser?.kill('SIGTERM');server?.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});}
