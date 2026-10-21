import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createNativeExportWarmPool } from '../../public/gridfinity-converter/native-export-warm-pool.js';

const source = fs.readFileSync(new URL('../../public/gridfinity-converter/app.js', import.meta.url), 'utf8');
const prepare = source.slice(source.indexOf('function prepareNativeExport(data)'), source.indexOf('async function exportMesh()'));
const cancel = source.slice(source.indexOf('function cancelNativeExport()'), source.indexOf('function terminate('));
const pagehide = source.slice(source.indexOf("addEventListener('pagehide'"), source.indexOf('const $ ='));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const cases = [];
for (const mode of ['pending-warm', 'active-step', 'cold-mesh']) {
  const workers = [], listeners = {};
  class FakeWorker {
    constructor() { workers.push(this); }
    postMessage(data) { this.request = data; }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage?.({ data }); }
  }
  const pool = createNativeExportWarmPool({ createWorker: () => new FakeWorker() });
  const result = { geometry: 'preserved' }, settings = { style: 'magnets' };
  const context = { nativeExportWarmPool: pool, AbortController, DOMException, Error, Worker: FakeWorker,
    raw: null, result, settings, busy: true, setBusy(value) { context.busy = value; }, status() {},
    addEventListener(type, listener) { listeners[type] = listener; } };
  vm.createContext(context);
  vm.runInContext('let exportAbort, exportWorker, exportReject;\n' + cancel + prepare + pagehide, context);
  const request = mode === 'cold-mesh' ? { type: 'mesh' } : { type: 'pose', format: 'brep', requestedFormat: 'step' };
  if (mode === 'pending-warm') void pool.prewarm();
  const pending = context.prepareNativeExport(request);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await tick();
  listeners.pagehide();
  await rejected;
  assert.equal(context.busy, false);
  assert.equal(context.result, result);
  assert.equal(context.settings, settings);
  assert.ok(workers.every(worker => worker.terminated));
  const retry = context.prepareNativeExport(request);
  await tick();
  const output = { report: { stepRoundTripValid: true } };
  workers.at(-1).emit({ result: output });
  assert.equal(await retry, output);
  assert.ok(workers.every(worker => worker.terminated));
  pool.dispose();
  cases.push(mode);
}
console.log(JSON.stringify({ passed: cases.length, cases, conversionAndSettingsPreserved: true }));
