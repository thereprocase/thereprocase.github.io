// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
const [folder, output] = process.argv.slice(2);
if (!folder || !output)
  throw Error(
    'Usage: AUDIT_MANIFEST=manifest.json node check-internet-models.mjs public results.json',
  );
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
    url: process.env.AUDIT_URL || `http://127.0.0.1:${port}/gridfinity-converter/`,
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

  const ready = async (allowStartupNavigation = false) => {
    let lastStatus = '';
    for (
      let i = 0;
      i < Number(process.env.AUDIT_TIMEOUT_SECONDS || 120) * 10;
      i++
    ) {
      await pause(100);
      let state;
      try {
        state = await evaluate(
          "({busy:document.body?.dataset.busy,status:document.getElementById('status')?.textContent})",
        );
      } catch (error) {
        // Isolation may replace the initial document before model selection.
        // Never hide navigation/errors during an import or conversion.
        if (allowStartupNavigation && /Inspected target navigated|Execution context was destroyed|Cannot find (?:default execution context|context with specified id)/.test(error.message)) continue;
        throw error;
      }
      if (process.env.AUDIT_PROGRESS && state.status !== lastStatus)
        console.log(new Date().toISOString(), state.status);
      lastStatus = state.status;
      if (allowStartupNavigation && /^The converter could not start:/.test(lastStatus || ''))
        throw Error(lastStatus);
      if (state.busy === 'false') return state.status;
    }
    throw Error('Timed out: ' + lastStatus);
  };
  await ready(true);
  await evaluate(
    `window.auditBlobs=[];window.auditDownloads=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.auditBlobs.push(blob);return create(blob)};const anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)window.auditDownloads.push({filename:this.download,href:this.href});return anchorClick.call(this)};`,
  );
  const manifest = JSON.parse(
    await fs.readFile(process.env.AUDIT_MANIFEST, 'utf8'),
  );
  const results = [];
  for (const item of manifest) {
    const record = { ...item, conversions: [] };
    try {
      record.sourceSHA256 = createHash('sha256').update(await fs.readFile(item.path)).digest('hex');
      if (item.sha256 && record.sourceSHA256 !== item.sha256.toLowerCase())
        throw Error('Input model SHA-256 differs from the benchmark manifest');
      const doc = await call('DOM.getDocument');
      const input = await call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#files',
      });
      const loadStarted = Date.now();
      await call('DOM.setFileInputFiles', {
        nodeId: input.nodeId,
        files: [item.path],
      });
      record.importStatus = await ready();
      record.importElapsedMS = Date.now() - loadStarted;
      if (process.env.AUDIT_WAIT_PREPARED) {
        for (let i = 0; i < 1200; i++) {
          record.preparationStatus = await evaluate("document.getElementById('cad-preparation')?.textContent || ''");
          if (/prepared for conversion|another check/.test(record.preparationStatus)) break;
          if (i === 1199) throw Error('Timed out waiting for native preparation');
          await pause(100);
        }
        record.loadToPreparedMS = Date.now() - loadStarted;
      }
      record.detection = await evaluate(
        `({note:document.getElementById('detection-note').textContent,feet:document.querySelectorAll('#feet tr').length,selected:document.getElementById('selection-count').textContent,enabled:!document.getElementById('convert').disabled,dimensions:document.getElementById('model-size').textContent,bodies:document.getElementById('body').options.length,bodyNote:document.getElementById('body-note').textContent})`,
      );
      if (process.env.AUDIT_SCREENSHOTS) {
        await evaluate(
          "document.getElementById('underside').click();document.getElementById('preview-panel').scrollIntoView({block:'start'})",
        );
        await pause(300);
        const screenshot = await call('Page.captureScreenshot', {
          format: 'png',
        });
        await fs.writeFile(
          path.join(path.dirname(output), path.basename(item.path) + '.png'),
          Buffer.from(screenshot.data, 'base64'),
        );
      }
      if (!record.detection.enabled) throw Error('Import did not enable conversion: ' + record.importStatus);
      if (process.env.AUDIT_NATIVE_CANCEL) {
        await evaluate(`{
          window.cancelAudit = { terminated:false, retainedWorker:false };
          const post=Worker.prototype.postMessage, terminate=Worker.prototype.terminate;
          Worker.prototype.terminate=function(...args){if(this===window.cancelAudit.worker)window.cancelAudit.terminated=true;return terminate.apply(this,args);};
          Worker.prototype.postMessage=function(data,...args){
            if(data.type==='convert' && data.format==='step'){
              if(!window.cancelAudit.worker){
                Object.assign(window.cancelAudit,{worker:this,documentId:data.documentId,hasToken:data.cancelBuffer instanceof SharedArrayBuffer});
                this.addEventListener('message',({data:event})=>{
                  if(event.progress===${JSON.stringify(process.env.AUDIT_CANCEL_STAGE || 'Checking exact result geometry…')} && !window.cancelAudit.requested){
                    window.cancelAudit.requested=performance.now();document.getElementById('cancel').click();
                  }
                  if(event.cancelled){window.cancelAudit.ack=event;window.cancelAudit.latencyMS=performance.now()-window.cancelAudit.requested;}
                });
              }else{
                window.cancelAudit.retainedWorker=this===window.cancelAudit.worker && data.documentId===window.cancelAudit.documentId;
                Worker.prototype.postMessage=post;Worker.prototype.terminate=terminate;
              }
            }
            return post.call(this,data,...args);
          };
          document.getElementById('fit').value='0.15';document.getElementById('convert').click();
        }`);
        record.cancelStatus=await ready();
        record.cancelRecovery=await evaluate(`({terminated:window.cancelAudit.terminated,hasToken:window.cancelAudit.hasToken,clean:window.cancelAudit.ack?.clean,validationChildrenStopped:window.cancelAudit.ack?.validationChildrenStopped,pendingValidationTasks:window.cancelAudit.ack?.pendingValidationTasks,latencyMS:window.cancelAudit.latencyMS,retryEnabled:!document.getElementById('convert').disabled,fit:document.getElementById('fit').value})`);
        if(record.cancelRecovery.terminated || !record.cancelRecovery.clean || !record.cancelRecovery.retryEnabled || record.cancelRecovery.fit!=='0.15')throw Error('Cooperative cancellation failed: '+JSON.stringify(record.cancelRecovery)+' '+record.cancelStatus);
      }
      if (process.env.AUDIT_NATIVE_RECOVERY) {
        await evaluate(`{
          const post = Worker.prototype.postMessage;
          Worker.prototype.postMessage = function(data, ...args) {
            if (data?.type === 'convert' && ['step', 'brep'].includes(data.format)) {
              Worker.prototype.postMessage = post;
              queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
                data: {requestId:data.requestId, error:'Injected native runtime failure', stage:'Recovery audit'}
              })));
              return;
            }
            return post.call(this, data, ...args);
          };
          document.getElementById('convert').click();
        }`);
        record.recoveryStatus = await ready();
        record.recoveryRejected = await evaluate("document.getElementById('stl').disabled && !document.getElementById('convert').disabled");
        if (!record.recoveryStatus.includes('Injected native runtime failure') || !record.recoveryRejected)
          throw Error('Native failure did not return the model to a retryable state');
        // The ordinary variants below must succeed using the retained original
        // file bytes, without another selection or page reload.
      }
      if (record.detection.enabled)
        for (const [style, fit] of item.variants || [
          ['plain', 0],
          ...(process.env.AUDIT_ALL_STYLES
            ? [
                ['magnets', 0],
                ['screws', 0],
              ]
            : []),
          ['both', 0],
          ['plain', -0.5],
          ['plain', 0.2],
        ]) {
          const conversionStarted = Date.now();
          await evaluate(
            `document.getElementById('style').value=${JSON.stringify(style)};document.getElementById('fit').value=${fit};document.getElementById('fit').dispatchEvent(new Event('input'));document.getElementById('convert').click()`,
          );
          const attempt = { style, fit, status: await ready() };
          attempt.elapsedMS = Date.now() - conversionStarted;
          attempt.loadToReadyMS = Date.now() - loadStarted;
          attempt.success = await evaluate(
            "!document.getElementById('stl').disabled",
          );
          record.conversions.push(attempt);
          if(process.env.AUDIT_NATIVE_CANCEL){record.cancelRetry=await evaluate('window.cancelAudit.retainedWorker');if(!record.cancelRetry)throw Error('Retry lost retained native worker');}
          if (!attempt.success) process.exitCode = 1;
          if (attempt.success) {
            await evaluate("document.getElementById('report').click()");
            attempt.report = JSON.parse(
              await evaluate('window.auditBlobs.at(-1).text()'),
            );
            const requiredEngine = process.env.AUDIT_REQUIRE_NATIVE_ENGINE;
            if (requiredEngine && attempt.report.conversion?.nativeKernel?.engine !== requiredEngine) {
              attempt.success = false;
              attempt.status = `Expected native engine ${requiredEngine}; received ${attempt.report.conversion?.nativeKernel?.engine ?? 'none'}.`;
              process.exitCode = 1;
              throw Error(attempt.status);
            }
            if (!process.env.AUDIT_SKIP_DOWNLOADS) {
            const meshBlobCount = await evaluate('window.auditBlobs.length');
            const meshExportStarted = Date.now();
            await evaluate("document.getElementById('stl').click()");
            attempt.meshExportStatus = await ready();
            attempt.meshExportElapsedMS = Date.now() - meshExportStarted;
            if (await evaluate('window.auditBlobs.length') <= meshBlobCount) throw Error('Mesh export produced no download: ' + attempt.meshExportStatus);
            const encoded = await evaluate(
              `new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(window.auditBlobs.at(-1))})`,
            );
            attempt.exportPath = path.join(
              path.dirname(output),
              path.basename(item.path) + '.' + style + '.' + fit + '.stl',
            );
            await fs.writeFile(
              attempt.exportPath,
              Buffer.from(encoded, 'base64'),
            );
            }
          }
          if (
            attempt.success && !process.env.AUDIT_SKIP_DOWNLOADS &&
            (await evaluate("!document.getElementById('step').disabled"))
          ) {
            const nativeBlobCount = await evaluate('window.auditBlobs.length');
            const nativeExportStarted = Date.now();
            await evaluate("document.getElementById('step').click()");
            attempt.nativeExportStatus = await ready();
            attempt.nativeExportElapsedMS = Date.now() - nativeExportStarted;
            if (await evaluate('window.auditBlobs.length') <= nativeBlobCount) throw Error('Native export produced no download: ' + attempt.nativeExportStatus);
            const encoded = await evaluate(
              `new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(window.auditBlobs.at(-1))})`,
            );
            const format =
              (await evaluate('window.auditDownloads.at(-1).filename')).split('.').at(-1);
            const exportPath = attempt.exportPath.replace(
              /\.stl$/,
              '.' + format,
            );
            attempt[format + 'ExportPath'] = exportPath;
            await fs.writeFile(exportPath, Buffer.from(encoded, 'base64'));
          }
          if (attempt.success && process.env.AUDIT_TRANSLATE_STEP) {
            const before = await evaluate('window.auditBlobs.length');
            const started = Date.now();
            if (await evaluate("document.getElementById('translate-step').disabled"))
              throw Error('STEP translation is disabled');
            await evaluate("document.getElementById('translate-step').click()");
            attempt.stepTranslationStatus = await ready();
            attempt.stepTranslationElapsedMS = Date.now() - started;
            attempt.loadToStepReadyMS = Date.now() - loadStarted;
            attempt.stepTranslationSuccess = await evaluate(`window.auditBlobs.length > ${before} && /\\.step$/i.test(window.auditDownloads.at(-1)?.filename || '')`);
            if (!attempt.stepTranslationSuccess) {
              process.exitCode = 1;
              throw Error('STEP translation produced no STEP download: ' + attempt.stepTranslationStatus);
            }
            const encoded = await evaluate('window.auditBlobs.at(-1).text()');
            if (!encoded.trimStart().startsWith('ISO-10303-21;')) throw Error('STEP download has an invalid file header');
            attempt.translatedStepExportPath = path.join(path.dirname(output), path.basename(item.path) + '.' + style + '.' + fit + '.translated.step');
            await fs.writeFile(attempt.translatedStepExportPath, encoded);
            await evaluate("document.getElementById('report').click()");
            attempt.report = JSON.parse(await evaluate('window.auditBlobs.at(-1).text()'));
            const translation = attempt.report.conversion.translatedBaseStep || attempt.report.conversion.translatedSourceStep;
            if (!translation?.stepRoundTripValid || translation.nativeExportFormat !== 'step')
              throw Error('STEP download lacks a passing independent reopen report');
          }
          console.log(path.basename(item.path), style, fit, attempt.status);
          await fs.writeFile(
            output,
            JSON.stringify([...results, record], null, 2) + '\n',
          );
        }
    } catch (error) {
      record.error = error.message;
      process.exitCode = 1;
    }
    results.push(record);
    await fs.writeFile(output, JSON.stringify(results, null, 2) + '\n');
    console.log(
      path.basename(item.path),
      record.importStatus,
      record.conversions
        .map((x) => `${x.style}/${x.fit}: ${!x.success ? x.status : x.stepTranslationSuccess === false ? 'conversion OK; STEP FAILED' : 'OK'}`)
        .join('; '),
    );
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
