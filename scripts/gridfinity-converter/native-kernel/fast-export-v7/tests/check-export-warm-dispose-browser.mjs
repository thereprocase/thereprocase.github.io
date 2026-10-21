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
  server=spawn('python3',['-u','/tmp/step-export-range-site/server.py',path.resolve(folder)],{stdio:['ignore','pipe','ignore']});
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
  await call('Page.navigate', {
    url: `http://127.0.0.1:${port}/test.html`,
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

  await pause(500);
  const result={rounds:[]};
  await evaluate(`(async()=>{const {createNativeExportWarmPool}=await import('/gridfinity-converter/native-export-warm-pool.js');globalThis.pool=createNativeExportWarmPool();})()`);
  for(let i=0;i<3;i++){
    const warm=await evaluate('pool.prewarm()');
    const during=(await call('Target.getTargets')).targetInfos.filter(t=>t.type==='worker');
    await evaluate('pool.dispose()');await pause(300);
    const after=(await call('Target.getTargets')).targetInfos.filter(t=>t.type==='worker');
    result.rounds.push({warm,workersDuring:during.map(t=>t.url),workersAfter:after.map(t=>t.url)});
    if(!warm.ready||after.length)throw Error('Warm lifecycle failed '+JSON.stringify(result));
  }
  await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();browser?.kill('SIGTERM');server?.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});}
