// Self-contained capture with installed Node (native WebSocket), Python3, Chromium.
import { spawn } from 'node:child_process';
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
    let lastStatus = '';
    for (
      let i = 0;
      i < Number(process.env.AUDIT_TIMEOUT_SECONDS || 120) * 10;
      i++
    ) {
      await pause(100);
      const state = await evaluate(
        "({busy:document.body.dataset.busy,status:document.getElementById('status')?.textContent})",
      );
      lastStatus = state.status;
      if (state.busy === 'false') return state.status;
    }
    throw Error('Timed out: ' + lastStatus);
  };
  await ready();
  await evaluate(
    `window.auditBlobs=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.auditBlobs.push(blob);return create(blob)};`,
  );
  const manifest = JSON.parse(
    await fs.readFile(process.env.AUDIT_MANIFEST, 'utf8'),
  );
  const results = [];
  for (const item of manifest) {
    const record = { ...item, conversions: [] };
    try {
      const doc = await call('DOM.getDocument');
      const input = await call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#files',
      });
      await call('DOM.setFileInputFiles', {
        nodeId: input.nodeId,
        files: [item.path],
      });
      record.importStatus = await ready();
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
          ['plain', 0.5],
        ]) {
          const conversionStarted = Date.now();
          await evaluate(
            `document.getElementById('style').value=${JSON.stringify(style)};document.getElementById('fit').value=${fit};document.getElementById('fit').dispatchEvent(new Event('input'));document.getElementById('convert').click()`,
          );
          const attempt = { style, fit, status: await ready() };
          attempt.elapsedMS = Date.now() - conversionStarted;
          attempt.success = await evaluate(
            "!document.getElementById('stl').disabled",
          );
          if (attempt.success) {
            await evaluate("document.getElementById('report').click()");
            attempt.report = JSON.parse(
              await evaluate('window.auditBlobs.at(-1).text()'),
            );
            await evaluate("document.getElementById('stl').click()");
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
          if (
            attempt.success &&
            (await evaluate("!document.getElementById('step').disabled"))
          ) {
            await evaluate("document.getElementById('step').click()");
            const encoded = await evaluate(
              `new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(window.auditBlobs.at(-1))})`,
            );
            attempt.stepExportPath = attempt.exportPath.replace(
              /\.stl$/,
              '.step',
            );
            await fs.writeFile(
              attempt.stepExportPath,
              Buffer.from(encoded, 'base64'),
            );
          }
          record.conversions.push(attempt);
          console.log(path.basename(item.path), style, fit, attempt.status);
          await fs.writeFile(
            output,
            JSON.stringify([...results, record], null, 2) + '\n',
          );
        }
    } catch (error) {
      record.error = error.message;
    }
    results.push(record);
    await fs.writeFile(output, JSON.stringify(results, null, 2) + '\n');
    console.log(
      path.basename(item.path),
      record.importStatus,
      record.conversions
        .map((x) => `${x.style}/${x.fit}: ${x.success ? 'OK' : x.status}`)
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
