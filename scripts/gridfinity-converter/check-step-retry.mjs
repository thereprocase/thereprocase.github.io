import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual UI handler: a rejected STEP must not poison later retries.
const source = await readFile(new URL('../../public/gridfinity-converter/app.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf("$('translate-step').onclick ="), source.indexOf("$('report').onclick ="));
assert.ok(handler.startsWith("$('translate-step').onclick ="));
for (const originalPose of [false, true]) {
  const elements = { 'translate-step': {}, 'source-pose': { checked: originalPose } };
  const result = { brep: new ArrayBuffer(4), report: {}, originalPoseExport: { transform: { rotation: [], translation: [] } } };
  let requests = 0;
  const downloads = [], messages = [];
  const context = vm.createContext({
    $: id => elements[id], result, busy: false, epoch: 1, DOMException,
    setBusy: value => { context.busy = value; },
    status: message => messages.push(message), filename: ext => `part.${ext}`,
    download: (...args) => downloads.push(args),
    prepareNativeExport: async () => {
      requests++;
      if (requests === 1) return { format: 'brep', buffer: result.brep, report: { stepRoundTripValid: false } };
      return { format: 'step', buffer: new ArrayBuffer(8), report: { stepRoundTripValid: true } };
    },
  });
  vm.runInContext(handler, context);
  await elements['translate-step'].onclick();
  assert.equal(downloads.length, 0, 'Rejected STEP cannot download the BREP as STEP');
  assert.match(messages[0], /failed validation/);
  assert.equal(context.busy, false);
  await elements['translate-step'].onclick();
  assert.equal(requests, 2, 'Retry must run the export worker again');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0][2], 'part.step');
  const key = originalPose ? 'translatedSourceStep' : 'translatedBaseStep';
  assert.equal(result.report[key].stepRoundTripValid, true);
  await elements['translate-step'].onclick();
  assert.equal(requests, 2, 'Successful validated bytes remain cached');
  assert.equal(downloads.length, 2);
}
console.log('Both STEP poses retry rejected exports and cache only validated STEP bytes.');
