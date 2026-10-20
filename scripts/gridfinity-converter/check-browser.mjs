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
  const startsWithModel = await evaluate(
    "document.querySelector('[aria-current=step]').dataset.stage==='1' && document.getElementById('file-state').textContent==='No model selected' && document.querySelectorAll('#feet tr').length===0 && document.getElementById('convert').disabled && document.getElementById('workflow-action').textContent==='Choose your model…'",
  );
  await evaluate("document.getElementById('demo').click()");
  await ready();
  const results = {
    startsWithModel,
    demo: await evaluate("document.querySelectorAll('#feet tr').length===2"),
    fixedPitch: await evaluate(
      "document.getElementById('detection-note').textContent.includes('42 mm grid')",
    ),
  };
  results.examplePicker = await evaluate(
    "document.getElementById('file-state').textContent==='Built-in example' && document.getElementById('choose-file').textContent==='Choose your model…' && getComputedStyle(document.getElementById('files')).display==='none'",
  );
  results.frictionAdjustment = await evaluate(`(() => {
    const field = document.getElementById('fit');
    field.value = '0.02';
    const typed = field.checkValidity();
    document.getElementById('fit-up').click();
    const up = field.value === '0.07';
    field.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
    const down = field.value === '0.02';
    document.getElementById('fit-down').click();
    const negative = field.value === '-0.03';
    field.value = '0.49'; document.getElementById('fit-up').click();
    const clamped = field.value === '0.50';
    field.value = '0.02'; field.dispatchEvent(new Event('input'));
    return typed && up && down && negative && clamped;
  })()`);
  results.directAction = await evaluate(
    "!document.getElementById('confirm')&&!document.getElementById('workflow-action').disabled",
  );
  await evaluate("document.getElementById('workflow-action').click()");
  await ready();
  results.converted = await evaluate(
    "!document.getElementById('stl').disabled&&document.getElementById('status').textContent.startsWith('Conversion ready')",
  );
  await evaluate("document.getElementById('underside').click()");
  await pause(300);
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(output, Buffer.from(shot.data, 'base64'));
  await call('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: path.dirname(path.resolve(output)),
  });
  await evaluate(
    "document.getElementById('stl').click();document.getElementById('three-mf').click();document.getElementById('report').click()",
  );
  await pause(1000);
  results.downloads =
    (await fs.readdir(path.dirname(path.resolve(output)))).filter((n) =>
      /^example-bin-both-42mm\.(stl|3mf|json)$/.test(n),
    ).length === 3;
  await evaluate(
    "document.getElementById('style').value='plain';document.getElementById('style').dispatchEvent(new Event('input'))",
  );
  results.stale = await evaluate(
    "document.getElementById('stl').disabled&&!document.getElementById('workflow-action').disabled",
  );
  results.workflow = await evaluate(
    "document.querySelector('[aria-current=step]').dataset.stage==='2' && document.getElementById('step').hidden && document.getElementById('selection-count').textContent==='2 selected'",
  );
  await evaluate("document.getElementById('select-none').click()");
  results.emptySelectionHelp = await evaluate(
    "document.getElementById('convert').disabled && document.getElementById('convert-help').textContent.includes('Select at least one')",
  );
  await evaluate("document.getElementById('select-all').click()");
  for (const width of [320, 390, 768, 1600]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await pause(200);
    results['layout' + width] = await evaluate(
      'document.documentElement.scrollWidth<=innerWidth',
    );
    await evaluate(
      'document.querySelector(\'[href="#selection-panel"]\').click()',
    );
    // Allow fragment scrolling and ResizeObserver-driven sticky offsets to settle.
    await pause(200);
    results['anchor' + width] = await evaluate(
      "document.getElementById('selection-panel').getBoundingClientRect().top>=document.getElementById('workflow').getBoundingClientRect().bottom",
    );
    if (width === 390) {
      await evaluate(
        "document.getElementById('preview-panel').scrollIntoView({block:'start'});document.getElementById('underside').click()",
      );
      await pause(200);
      const mobile = await call('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(
        output + '.mobile.png',
        Buffer.from(mobile.data, 'base64'),
      );
    }
    await evaluate('scrollTo(0,0)');
  }

  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(
    "document.getElementById('replacement-panel').scrollIntoView();document.getElementById('convert').click()",
  );
  await ready();
  results.mobilePreview = await evaluate(
    "document.getElementById('preview-panel').getBoundingClientRect().top>=document.getElementById('workflow').getBoundingClientRect().bottom && document.getElementById('preview-panel').getBoundingClientRect().top<250 && !document.getElementById('export-shortcut').hidden && document.body.dataset.view==='converted'",
  );
  const completed = await call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    output + '.mobile-result.png',
    Buffer.from(completed.data, 'base64'),
  );
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await evaluate(
    "document.getElementById('style').dispatchEvent(new Event('input'));document.getElementById('grid-x').value='0.1234';document.getElementById('grid-y').value='-0.5678';document.getElementById('column').value='0.5';document.getElementById('workflow-action').click()",
  );
  await ready();
  results.unappliedGridIgnored = await evaluate(
    "!document.getElementById('stl').disabled && document.getElementById('status').textContent.startsWith('Conversion ready')",
  );
  await evaluate(
    "document.getElementById('height').value='2';document.getElementById('height').dispatchEvent(new Event('input'));document.getElementById('workflow-action').click()",
  );
  results.visibleValidation = await evaluate(
    "document.getElementById('status').classList.contains('error') && document.getElementById('status').textContent.includes('Replacement height')",
  );
  await evaluate(
    "document.getElementById('height').value='4.75';document.getElementById('height').dispatchEvent(new Event('input'));document.getElementById('column').value='0'",
  );
  if (process.env.CUSTOM_MODEL) {
    const doc = await call('DOM.getDocument'),
      input = await call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#files',
      });
    await call('DOM.setFileInputFiles', {
      nodeId: input.nodeId,
      files: [path.resolve(process.env.CUSTOM_MODEL)],
    });
    await ready();
    results.uploadedPicker = await evaluate(
      "document.getElementById('file-state').textContent==='Current model' && document.getElementById('choose-file').textContent==='Replace model…' && document.getElementById('file-info').textContent.endsWith('.stl')",
    );
    results.customDetected = await evaluate(
      `document.querySelectorAll('#feet tr').length===${Number(process.env.CUSTOM_FEET || 2)} && !document.getElementById('workflow-action').disabled`,
    );
    await evaluate(
      "document.getElementById('style').value='both';document.getElementById('style').dispatchEvent(new Event('input'));document.getElementById('workflow-action').click()",
    );
    await ready();
    if (process.env.CUSTOM_FEET === '1')
      results.fittedDepthShown = await evaluate(
        "document.getElementById('conversion-note').textContent.includes('3.9 mm')",
      );
    results.customConverted = await evaluate(
      "!document.getElementById('stl').disabled && document.getElementById('status').textContent.startsWith('Conversion ready')",
    );
  }
  if (process.env.CUSTOM_MODEL && results.customConverted) {
    const doc = await call('DOM.getDocument'),
      input = await call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#files',
      });
    await call('DOM.setFileInputFiles', {
      nodeId: input.nodeId,
      files: [path.resolve(process.env.CUSTOM_MODEL)],
    });
    await ready();
    results.sameFileReload = await evaluate(
      "document.getElementById('stl').disabled && document.getElementById('status').textContent.includes('Feet detected')",
    );
  }
  if (results.customConverted === false)
    throw Error(
      await evaluate("document.getElementById('status').textContent"),
    );
  await evaluate(
    "document.getElementById('grid-x').value=String(Number(document.getElementById('grid-x').value)+.25);document.getElementById('column').value='10';document.getElementById('add-cell').click()",
  );
  results.pendingGridEdit = await evaluate(
    "document.getElementById('status').textContent==='Apply the grid origin before adding a cell.'",
  );
  if (process.env.CHECK_IMPORTS) {
    results.imports = await evaluate(`(async()=>{
   const {importFile,export3MF}=await import('./importers.js');
   const g=await (await fetch('/converter-test-fixtures/mesh.json')).json();g.vertices=new Float32Array(g.vertices);g.triangles=new Uint32Array(g.triangles);
   const files=await Promise.all(['stl','obj','off','ply','amf','gltf','glb','step','iges','brep','bin'].map(async ext=>new File([await(await fetch('/converter-test-fixtures/part.'+ext)).arrayBuffer()],'part.'+ext)));
   files.push(new File([export3MF(g,{})],'part.3mf'));
   const {unzipSync,zipSync,strToU8,strFromU8}=await import('./vendor/three/libs/fflate.module.js');const inch={vertices:Float32Array.from(g.vertices,x=>x/25.4),triangles:g.triangles},archive=unzipSync(export3MF(inch,{}));let xml=strFromU8(archive['3D/3dmodel.model']).replace('unit="millimeter"','unit="inch"').replace('</resources>','<object id="2" type="model"><components><component objectid="1" transform="1 0 0 0 1 0 0 0 1 4 2 1"/></components></object></resources>').replace('<item objectid="1"/>','<item objectid="2"/>');archive['3D/3dmodel.model']=strToU8(xml);files.push(new File([zipSync(archive)],'inch-assembly.3mf'));

   const worker=new Worker('./worker.js',{type:'module'});let id=0;const rpc=(type,data)=>new Promise((resolve,reject)=>{worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.result);worker.postMessage({id:++id,type,...data});});
   const checks=[];try{for(const file of files.filter(f=>!f.name.endsWith('.bin'))){const raw=await importFile(file,files);const loaded=await rpc('load',{geometry:raw,scale:raw.unitScale}).catch(e=>{throw Error(file.name+': '+e.message);});if(loaded.bodies.length!==1)throw Error(file.name+' body count');const d=await rpc('detect',{options:{orientation:'auto'}});if(d.grid.matched!==2)throw Error(file.name+' detection '+d.grid.matched);const r=await rpc('convert',{options:{feet:d.feet,style:'both'}});if(r.report.connectedSolids!==1)throw Error(file.name+' conversion');checks.push({file:file.name,feet:d.grid.matched,outsideChange:r.report.outsideChange});}return checks;}finally{worker.terminate();}
  })()`);
    console.log(results.imports);
    const doc = await call('DOM.getDocument'),
      input = await call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#files',
      });
    await call('DOM.setFileInputFiles', {
      nodeId: input.nodeId,
      files: [path.resolve(folder, 'converter-test-fixtures/native.step')],
    });
    await ready();
    results.nativeDetection = await evaluate(
      "document.querySelectorAll('#feet tr').length===2",
    );
    await evaluate(
      "document.getElementById('style').value='both';document.getElementById('convert').click()",
    );
    await ready();
    results.nativeConversion = await evaluate(
      "!document.getElementById('step').disabled&&document.getElementById('status').textContent.includes('Native CAD')",
    );
    await evaluate("document.getElementById('step').click()");
    await pause(500);
    results.nativeDownload = (
      await fs.readdir(path.dirname(path.resolve(output)))
    ).includes('native-both-42mm.step');
  }
  if (Object.values(results).some((v) => !v))
    throw Error(JSON.stringify(results));
  await fs.writeFile(output + '.json', JSON.stringify(results, null, 2) + '\n');
  console.log(results);
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
