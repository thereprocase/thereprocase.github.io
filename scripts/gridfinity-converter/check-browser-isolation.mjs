// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
const [
  folder = 'public',
  output = '/tmp/gridfinity-isolation-check',
  mode = 'normal',
] = process.argv.slice(2);
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
      `import http.server,functools,sys,time
class Handler(http.server.SimpleHTTPRequestHandler):
 def do_GET(self):
  if sys.argv[2]=='delayed-app' and self.path.split('?')[0].endswith('/app.js'): time.sleep(2)
  super().do_GET()
 def do_POST(self):
  self.rfile.read(int(self.headers.get('Content-Length','0')))
  self.send_response(204)
  self.end_headers()
s=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Handler,directory=sys.argv[1]))
print(s.server_port,flush=True)
s.serve_forever()`,
      path.resolve(folder),
      mode,
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
  await call('Page.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source:
      mode === 'timeout'
        ? "navigator.serviceWorker.register=()=>new Promise(()=>{});window.bootStarted=performance.now();setTimeout(()=>{window.gateSnapshot={picker:document.getElementById('files')?.disabled,example:document.getElementById('demo')?.disabled};},100);"
        : "sessionStorage.setItem('isolation-test-loads',String(Number(sessionStorage.getItem('isolation-test-loads')||0)+1));window.pickerPrematurelyEnabled=false;new MutationObserver(()=>{const p=document.getElementById('files');if(p&&!p.disabled&&typeof p.onchange!=='function')window.pickerPrematurelyEnabled=true;}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});",
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
        "({busy:document.body?.dataset.busy,status:document.getElementById('status')?.textContent})",
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
  if (mode === 'delayed-app') {
    const state = await evaluate("(async()=>({premature:window.pickerPrematurelyEnabled,pickerDisabled:document.getElementById('files').disabled,listenerReady:typeof document.getElementById('files').onchange==='function',loads:Number(sessionStorage.getItem('isolation-test-loads')),postStatus:(await fetch('/diagnostics-test',{method:'POST',body:'test',keepalive:true})).status}))()");
    if (state.premature || state.pickerDisabled || !state.listenerReady || state.loads!==2 || state.postStatus!==204) throw Error(JSON.stringify(state));
    await fs.writeFile(output + '.json', JSON.stringify(state,null,2));
    console.log(state);
  } else if (mode === 'timeout') {
    const state = await evaluate(
      "({isolated:crossOriginIsolated,bootstrap:document.documentElement.dataset.cadIsolation,pickerDisabled:document.getElementById('files').disabled,exampleDisabled:document.getElementById('demo').disabled,elapsedMS:performance.now()-bootStarted,gates:window.gateSnapshot})",
    );
    if (
      state.isolated ||
      state.bootstrap !== 'single-registration-unavailable' ||
      state.pickerDisabled ||
      state.exampleDisabled ||
      state.elapsedMS > 6000 ||
      !state.gates?.picker ||
      !state.gates?.example
    )
      throw Error(JSON.stringify(state));
    await fs.writeFile(output + '.json', JSON.stringify(state, null, 2));
    console.log(state);
  } else {
    const report = {
      initial: await evaluate(
        "({isolated:crossOriginIsolated,bootstrap:document.documentElement.dataset.cadIsolation,pickerDisabled:document.getElementById('files').disabled,controlled:!!navigator.serviceWorker.controller,loads:Number(sessionStorage.getItem('isolation-test-loads'))})",
      ),
    };
    if (
      !report.initial.isolated ||
      report.initial.pickerDisabled ||
      report.initial.loads !== 2
    )
      throw Error('Isolation bootstrap failed ' + JSON.stringify(report));
    const origin = await evaluate('location.origin');
    const runWorker = (code) =>
      evaluate(
        `new Promise(resolve=>{const url=URL.createObjectURL(new Blob([${JSON.stringify(code)}],{type:'text/javascript'}));const worker=new Worker(url,{type:'module'});worker.onmessage=({data})=>{worker.terminate();URL.revokeObjectURL(url);resolve(data);};worker.onerror=error=>{worker.terminate();URL.revokeObjectURL(url);resolve({error:error.message});};})`,
      );
    report.parallelSmoke = await runWorker(`
    import {initNativeKernel,nativeKernelInfo} from '${origin}/gridfinity-converter/native-kernel.js?v=native-local-20261020-1';
    import * as cad from '${origin}/gridfinity-converter/vendor/replicad/replicad.js';
    try {
      const oc=await initNativeKernel();cad.setOC(oc);
      const a=cad.makeBox([0,0,0],[8,9,10]),b=cad.makeBox([4,0,0],[12,9,10]);
      function operation(kind,parallel,left=a,right=b){
        const op=new oc['BRepAlgoAPI_'+kind](),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();
        try{args.Append(left.wrapped);tools.Append(right.wrapped);op.SetArguments(args);op.SetTools(tools);op.SetNonDestructive(true);op.SetFuzzyValue(.00001);op.SetRunParallel(parallel);op.Build();return cad.cast(op.Shape());}
        finally{op.delete();args.delete();tools.delete();}
      }
      const results=[];
      for(const kind of ['Cut','Fuse','Common']){
        const serial=operation(kind,false),parallel=operation(kind,true);
        const exact=new oc.BRepCheck_Analyzer(parallel.wrapped,true,true,true);
        const left=operation('Cut',false,serial,parallel),right=operation('Cut',false,parallel,serial);
        results.push({kind,serial:cad.measureVolume(serial),parallel:cad.measureVolume(parallel),difference:Math.abs(cad.measureVolume(left))+Math.abs(cad.measureVolume(right)),valid:exact.IsValid(),exact:exact.IsExactMethod(),isParallel:exact.IsParallel()});
        left.delete();right.delete();exact.delete();serial.delete();parallel.delete();
      }
      const mesh=oc.ReplicadMeshExtractor.extract(a.wrapped,.1,.35,true);
      const triangles=mesh.getTrianglesSize()/3;mesh.delete();a.delete();b.delete();
      self.postMessage({runtime:nativeKernelInfo(oc),shared:oc.wasmMemory.buffer instanceof SharedArrayBuffer,results,triangles});
    }catch(error){self.postMessage({error:error.message??String(error)});}
  `);
    if (
      report.parallelSmoke.runtime?.engine !== 'pthread' ||
      !report.parallelSmoke.shared ||
      report.parallelSmoke.results?.some(
        (row) =>
          !row.valid ||
          !row.exact ||
          !row.isParallel ||
          Math.abs(row.serial - row.parallel) > 1e-8 ||
          row.difference > 1e-8,
      )
    )
      throw Error('Parallel native smoke failed ' + JSON.stringify(report));
    report.fallback = await evaluate(`new Promise(resolve=>{
    const url=location.origin+'/gridfinity-converter/native-kernel.js?v=native-local-20261020-1';
    const code=\`import {initNativeKernel,nativeKernelInfo} from '\${url}';
      const RealWorker=Worker;let created=0,terminated=0,failed=false;
      self.Worker=class extends RealWorker{
        constructor(...args){super(...args);created++;}
        postMessage(data,...rest){if(data.Sb==='load'&&!failed){failed=true;throw Error('Injected pthread startup failure');}return super.postMessage(data,...rest);}
        terminate(){terminated++;return super.terminate();}
      };
      const first=await import('\${url}'),second=await import('\${url}');
      const oc=await initNativeKernel();
      self.postMessage({runtime:nativeKernelInfo(oc),created,terminated,moduleIdentity:first===second});
    \`;
    const blob=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    const w=new Worker(blob,{type:'module'});
    w.onmessage=({data})=>{w.terminate();URL.revokeObjectURL(blob);resolve(data);};
    w.onerror=e=>{w.terminate();URL.revokeObjectURL(blob);resolve({error:e.message});};
  })`);
    if (
      report.fallback.runtime?.engine !== 'single' ||
      report.fallback.created !== report.fallback.terminated ||
      !report.fallback.moduleIdentity
    )
      throw Error('Fallback cleanup failed ' + JSON.stringify(report));
    await fs.writeFile(output + '.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
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
