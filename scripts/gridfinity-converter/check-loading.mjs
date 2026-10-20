// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
const [folder, output] = process.argv.slice(2);
if (!folder || !output)
  throw Error('Usage: node capture.mjs prepared-folder output.png');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cel-render-'));
let server, browser, ws;
try {
  server = spawn(
    'python3',
    [
      '-u',
      '-c',
      'import http.server,functools,sys; s=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])); print(s.server_port,flush=True); s.serve_forever()',
      path.resolve(folder),
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
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
  const ready = async () => {
    for (let i = 0; i < 900; i++) {
      await pause(100);
      const state = await evaluate(
        "({busy:document.body.dataset.busy,status:document.getElementById('status')?.textContent})",
      );
      if (state.busy === 'false') {
        if (/failed|could not|not a closed|invalid/i.test(state.status))
          throw Error(state.status);
        return state.status;
      }
    }
    throw Error('Timeout');
  };
  await ready();
  const checks = {};
  await evaluate("document.getElementById('demo').click()");
  checks.loadingVisible = await evaluate(
    "!document.getElementById('loading').hidden && !document.querySelector('#loading progress').hasAttribute('value') && document.getElementById('loading-elapsed').textContent.includes('Elapsed')",
  );
  await ready();
  checks.loadingHidden = await evaluate(
    "document.getElementById('loading').hidden",
  );
  await evaluate(
    "document.getElementById('convert').click();document.getElementById('cancel').click()",
  );
  checks.cancelHidesLoading = await evaluate(
    "document.body.dataset.busy==='false' && document.getElementById('loading').hidden",
  );
  const doc = await call('DOM.getDocument');
  const input = await call('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#files',
  });
  await evaluate(`window.importStages=[]; window.importStarted=performance.now();
    document.getElementById("files").addEventListener("change",e=>window.auditFile=e.target.files[0],{capture:true});
    new MutationObserver(()=>{const text=document.getElementById('loading-stage').textContent;
      if(text && window.importStages.at(-1)?.text!==text) window.importStages.push({text,ms:performance.now()-window.importStarted});
    }).observe(document.getElementById('loading-stage'),{subtree:true,childList:true,characterData:true});`);
  await call('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [path.resolve(process.env.CAD_TEST_FILE)],
  });
  await pause(500);
  checks.numberedProgress = await evaluate(
    "document.getElementById('loading-stage').textContent.includes('of 5') && document.querySelector('#loading progress').max===5",
  );
  await ready();
  const uiStages = await evaluate('window.importStages');
  checks.allImportStages = [1, 2, 3, 4, 5].every((n) =>
    uiStages.some((s) => s.text.startsWith('Import stage ' + n + ' of 5')),
  );
  checks.currentOperationTime = await evaluate(
    "document.getElementById('loading-elapsed').textContent.includes('Current operation')",
  );
  const budget = Number(process.env.PREVIEW_BUDGET || 2000);
  const imported = await evaluate(`new Promise(async(resolve,reject)=>{
    const w=new Worker('/gridfinity-converter/native-preview-worker.js?v=cad-progress-1',{type:'module'});
    const progress=[];
    const timer=setTimeout(()=>{w.terminate();reject(Error('CAD worker timeout'))},180000);
    w.onmessage=({data})=>{if(data.progress){progress.push({message:data.progress,...data.progressInfo});return;}clearTimeout(timer);w.terminate();data.error?reject(Error(data.error)):resolve({preview:data.preview,progress});};
    w.onerror=e=>reject(Error(e.message));
    const buffer=await window.auditFile.arrayBuffer();
    w.postMessage({format:'step',buffer,previewTriangleBudget:${budget}},[buffer]);
  })`);
  checks.adapted =
    imported.preview.adapted && imported.preview.triangles <= budget;
  checks.parsedOnce = imported.preview.nativeReadCount === 1;
  checks.stages = imported.progress.length >= 3;
  let legacy;
  if (process.env.COMPARE_LEGACY)
    legacy = await evaluate(`new Promise(async(resolve,reject)=>{
    const w=new Worker('/gridfinity-converter/cad-worker.js?v=cad-preview-1');
    const timer=setTimeout(()=>{w.terminate();reject(Error('Legacy CAD worker timeout'))},180000);
    w.onmessage=({data})=>{if(data.progress)return;clearTimeout(timer);w.terminate();data.error?reject(Error(data.error)):resolve(data.preview);};
    w.onerror=e=>reject(Error(e.message));
    const buffer=await window.auditFile.arrayBuffer();
    w.postMessage({format:'step',buffer,previewTriangleBudget:${budget}},[buffer]);
  })`);
  if (Object.values(checks).some((v) => !v))
    throw Error(JSON.stringify({ checks, imported }));
  await fs.writeFile(
    output + '.json',
    JSON.stringify({ checks, imported, uiStages, legacy }, null, 2) + '\n',
  );
  console.log({ checks, imported, uiStages, legacy });
} finally {
  ws?.close();
  browser?.kill();
  server?.kill();
  await pause(200);
  await fs.rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 100,
  });
}
