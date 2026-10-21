import { createNativeExportWarmPool } from './native-export-warm-pool.js?v=native-step-20261021-4';
import * as THREE from 'three';
import { illustrationMesh, PALETTE } from './illustration-view.js?v=native-step-20261021-4';
import { OrbitControls } from '/p1s-feet/vendor/OrbitControls.js';
import {
  STYLES,
  conversionParameters,
  LIMITS,
  binarySTL,
  restoreCoordinates,
  checkMesh,
} from './kernel.js?v=native-step-20261021-4';
import { importFile, extensions, export3MF } from './importers.js?v=native-step-20261021-4';
const nativeExportWarmPool = createNativeExportWarmPool();
addEventListener('pagehide', () => {
  if (cancelNativeExport()) {
    setBusy(false);
    status('Download preparation cancelled. Your conversion is still available.');
  }
});
const $ = (id) => document.getElementById(id),
  host = $('viewer');
let worker,
  cadWorker,
  nativeWorker,
  nativeReject,
  nativeCancellation,
  exportWorker,
  exportReject,
  exportAbort,
  nativePreparation,
  importAbort,
  sequence = 0,
  epoch = 0,
  busy = false,
  busyStarted = 0,
  busyTimer,
  raw = null,
  loaded = false,
  detection = null,
  result = null,
  feet = [],
  selection = new Set(),
  original = null,
  earlyPreview = null,
  sourceName = 'example-bin',
  sourceFormat = 'demo',
  view = 'original',
  isDemo = false;
let fileState = 'empty';
let busyInfo = null,
  operationStarted = 0,
  operationMessage = '';
const pending = new Map();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch {
  $('status').textContent =
    'WebGL is unavailable. Enable hardware acceleration or try another browser.';
  throw Error('WebGL required');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3efe6');
const camera = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(0.6), 1, 0.05, 100000);
camera.up.set(0, 0, 1);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
const root = new THREE.Group(),
  markers = new THREE.Group();
scene.add(root, markers);
const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 7),
  clips = [];
function clearGroup(group) {
  for (const o of group.children.slice()) {
    group.remove(o);
    o.traverse((n) => {
      n.userData.disposed = true;
      n.geometry?.dispose();
      [].concat(n.material ?? []).forEach((m) => m.dispose());
    });
  }
}
function modelMesh(data, color = PALETTE.teal, opacity = 1) {
  return illustrationMesh(data, { color, opacity, clips, camera, target: orbit.target, requestRender });
}
function draw() {
  document.body.dataset.view = view;
  $('legend-selected').textContent =
    view === 'changes' ? 'Added material' : 'Selected foot';
  $('legend-unselected').textContent =
    view === 'changes' ? 'Removed material' : 'Unselected foot';
  $('legend-selected').previousElementSibling.style.background = '#faa147';
  $('legend-unselected').previousElementSibling.style.background =
    view === 'changes' ? '#1d1b18' : '#899595';
  clearGroup(root);
  const data = view === 'original' || !result ? original : result.geometry;
  if (data) {
    root.add(
      modelMesh(
        data,
        view === 'changes' ? PALETTE.context : PALETTE.teal,
        view === 'changes' ? 0.22 : 1,
      ),
    );
    if (view === 'changes') {
      if (result.added.triangles.length)
        root.add(modelMesh(result.added, PALETTE.orange));
      if (result.removed.triangles.length)
        root.add(modelMesh(result.removed, PALETTE.ink, 0.65));
    }
  } else if (earlyPreview) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(earlyPreview.vertices, 3),
    );
    root.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x17616a,
          clippingPlanes: clips,
        }),
      ),
    );
  }
  for (const key of ['original', 'converted', 'changes'])
    $('view-' + key).setAttribute('aria-pressed', String(view === key));
  drawMarkers();
}
function drawMarkers() {
  requestRender();
  clearGroup(markers);
  if (!detection || view !== 'original') return;
  const bottom = Number($('bottom').value),
    height = Number($('height').value);
  for (const p of feet) {
    const selected = selection.has(p.id),
      g = new THREE.BoxGeometry(40.9, 40.9, height),
      m = new THREE.MeshBasicMaterial({
        color: selected ? 0xfaa147 : 0x899595,
        transparent: true,
        opacity: selected ? 0.16 : 0.08,
        depthWrite: false,
        // Cell bottoms coincide with real foot bottoms; bias only this review
        // overlay to prevent triangulation-shaped flicker on planar surfaces.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        side: THREE.DoubleSide,
        clippingPlanes: clips,
      }),
      mesh = new THREE.Mesh(g, m);
    mesh.position.set(p.x, p.y, bottom + height / 2);
    mesh.userData.footId = p.id;
    const e = new THREE.LineSegments(
      new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({
        color: selected ? 0xfaa147 : 0x536a6d,
        depthTest: false,
        clippingPlanes: clips,
      }),
    );
    mesh.add(e);
    markers.add(mesh);
  }
}
function resetView(under = false) {
  if (!root.children.length) return;
  const box = new THREE.Box3().setFromObject(root),
    center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3()),
    d =
      (Math.max(size.length() / 2, 12) /
        Math.sin(
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
              Math.min(1, camera.aspect),
          ),
        )) *
      1.15;
  orbit.target.copy(center);
  camera.position
    .copy(center)
    .add(
      under
        ? new THREE.Vector3(0.65, -0.8, -1).normalize().multiplyScalar(d)
        : new THREE.Vector3(Math.cos(-1.05) * Math.cos(0.87), Math.sin(-1.05) * Math.cos(0.87), Math.sin(0.87)).multiplyScalar(d),
    );
  camera.near = Math.max(0.01, d * 0.02);
  camera.far = d * 6;
  camera.updateProjectionMatrix();
  orbit.update();
  requestRender();
}
let renderFrame = null;
function requestRender() {
  if (renderFrame !== null || document.hidden) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    // Controls emit change events until damping settles, scheduling only
    // the frames needed for interaction. Idle CAD views consume no frames.
    orbit.update();
    const distance = camera.position.distanceTo(orbit.target);
    const near = Math.max(0.01, distance * 0.02), far = Math.max(near + 1, distance * 6);
    if (camera.near !== near || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  });
}
orbit.addEventListener('change', requestRender);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(renderFrame);
    renderFrame = null;
  } else requestRender();
});
new ResizeObserver(() => {
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  requestRender();
}).observe(host);
let down;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (busy || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
    return;
  const b = renderer.domElement.getBoundingClientRect(),
    ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      (-(e.clientY - b.top) / b.height) * 2 + 1,
    ),
    camera,
  );
  const hit = ray.intersectObjects(markers.children, false)[0];
  if (hit) {
    const id = hit.object.userData.footId;
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    invalidate();
    renderFeet();
  }
});
function status(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
  syncWorkflowHeight();
}
function canConvert() {
  return !busy && detection && selection.size > 0;
}
function controls() {
  for (const el of document.querySelectorAll(
    '.controls input,.controls select,.controls button',
  ))
    el.disabled = busy;
  $('demo').disabled = busy;
  $('choose-file').textContent =
    isDemo || fileState === 'empty'
      ? 'Choose your model…'
      : loaded
        ? 'Replace model…'
        : 'Choose another model…';
  $('file-state').textContent = {
    empty: 'No model selected',
    example: 'Built-in example',
    opening: 'Opening model…',
    loaded: 'Current model',
    error: 'Selected file · needs attention',
    cancelled: 'Cancelled · choose a model to continue',
  }[fileState];
  $('representation').hidden = !loaded;

  $('detect').disabled = busy || !loaded;
  $('convert').disabled = !canConvert();
  $('cancel').disabled = !busy;
  $('magnet-controls').disabled = !['magnets', 'both'].includes(
    $('style').value,
  );
  $('screw-controls').disabled = !['screws', 'both'].includes($('style').value);
  for (const id of [
    'stl',
    'three-mf',
    'report',
    'view-converted',
    'view-changes',
  ])
    $(id).disabled = busy || !result;
  $('step').disabled = busy || !(result?.step || result?.brep);
  $('step').textContent = result?.brep ? 'Download BREP' : 'Download STEP';
  $('step').hidden = !raw?.nativeBuffer;
  $('translate-step').disabled = busy || !result?.brep;
  $('translate-step').hidden = !raw?.nativeBuffer || Boolean(result?.step);
  $('export-shortcut').hidden = !result || busy;
  $('selection-count').textContent = `${selection.size} selected`;
  const native = Boolean(raw?.nativeBuffer);
  $('representation').textContent = native
    ? 'Native CAD · surfaces preserved'
    : isDemo
      ? 'Example · mesh model'
      : 'Mesh conversion · STL / 3MF export';
  $('export-format').textContent = native
    ? result?.brep
      ? result.report.stepExportError
        ? 'Native BREP · STEP export did not pass validation'
        : 'Native BREP · STEP translation available on request'
      : 'Native STEP · STL / 3MF mesh exports also available'
    : 'STL / 3MF mesh output · STEP requires a STEP or BREP source';
  $('convert-help').textContent = busy
    ? 'Processing locally. You can cancel above.'
    : !detection
      ? 'Load a model and detect its feet first.'
      : !selection.size
        ? 'Select at least one foot in step 2.'
        : `${selection.size} selected feet · ${STYLES[$('style').value]}. Click Convert feet to apply.`;
  $('workflow-action').disabled =
    busy || (fileState !== 'empty' && !result && !canConvert());
  $('workflow-action').textContent =
    fileState === 'empty'
      ? 'Choose your model…'
      : result
        ? 'Export files →'
        : busy
          ? 'Working…'
          : 'Convert feet';
  const stage = result ? '4' : detection ? '2' : '1';
  for (const link of document.querySelectorAll('[data-stage]')) {
    if (link.dataset.stage === stage) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  const cells = feet.filter((p) => p.gridMatch || p.manual);
  const span = cells.length
    ? `${Math.max(...cells.map((p) => p.column)) - Math.min(...cells.map((p) => p.column)) + 1} × ${Math.max(...cells.map((p) => p.row)) - Math.min(...cells.map((p) => p.row)) + 1} grid · `
    : '';
  $('viewer-summary').textContent = detection
    ? `${span}${selection.size} of ${feet.length} feet selected · 42 mm pitch`
    : earlyPreview
      ? 'STEP edge preview · preparing solid and feet'
      : 'Load a model to detect its male feet';
  $('section-z').disabled = !$('section').checked;
}
function setBusy(value, message, info) {
  if (value && message && message !== operationMessage) {
    operationStarted = performance.now();
    operationMessage = message;
  }
  if (info) busyInfo = info;
  if (!value) {
    busyInfo = null;
    operationMessage = '';
  }
  const progress = $('loading').querySelector('progress');
  if (busyInfo?.total) {
    progress.max = busyInfo.total;
    progress.value = busyInfo.stage - 1;
    progress.setAttribute('aria-label', 'Import stages completed');
    $('loading-stage').textContent =
      `Import stage ${busyInfo.stage} of ${busyInfo.total}` +
      (busyInfo.detail ? ` · ${busyInfo.detail}` : '');
  } else {
    progress.removeAttribute('value');
    progress.setAttribute('aria-label', 'Model processing');
    $('loading-stage').textContent = '';
  }
  if (value && !busy) {
    busyStarted = performance.now();
    const tick = () => {
      const seconds = Math.floor((performance.now() - busyStarted) / 1000);
      const operationSeconds = Math.floor(
        (performance.now() - operationStarted) / 1000,
      );
      const duration = (n) =>
        `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
      $('loading-elapsed').textContent =
        `Elapsed ${duration(seconds)} · Current operation ${duration(operationSeconds)} · Processing on this device`;
    };
    tick();
    busyTimer = setInterval(tick, 1000);
  } else if (!value) {
    clearInterval(busyTimer);
    busyTimer = null;
  }
  $('loading').hidden = !value;
  busy = value;
  document.body.dataset.busy = String(value);
  $('viewer-message').hidden = !value || Boolean(earlyPreview);
  if (message) {
    $('viewer-message').textContent = message;
    status(message);
  }
  controls();
  syncWorkflowHeight();
}
function invalidate(
  message = 'Settings changed. Review the selection and generate a new preview.',
) {
  result = null;
  view = 'original';
  $('conversion-note').textContent =
    'No current conversion. Review the selected cells and generate a preview.';
  $('conversion-metrics').replaceChildren();
  if (!busy) status(message);
  controls();
  draw();
}
function cancelNativeExport() {
  const abort = exportAbort, activeWorker = exportWorker, reject = exportReject;
  const active = Boolean(abort || activeWorker || reject);
  // Clear ownership before abort callbacks or a pending acquire resumes.
  exportAbort = exportWorker = exportReject = null;
  abort?.abort();
  activeWorker?.terminate();
  reject?.(new DOMException('Cancelled', 'AbortError'));
  nativeExportWarmPool.dispose();
  return active;
}
function terminate({ preserveIdleCAD = false, preserveLoadedMesh = false } = {}) {
  clearTimeout(nativeCancellation?.timer);
  nativeCancellation = null;
  const keepCAD = preserveIdleCAD && cadWorker && !nativeWorker && raw?.nativeDocumentId;
  // During native conversion the mesh worker is idle and still owns detection
  // input. Keep that input, but always discard the cancelled native workers.
  const keepMesh = preserveLoadedMesh && loaded && pending.size === 0;
  if (!keepCAD) {
    nativePreparation = null;
    $('cad-preparation').hidden = true;
  }
  earlyPreview = null;
  delete host.dataset.preview;
  importAbort?.abort();
  importAbort = null;
  if (!keepMesh) {
    worker?.terminate();
    worker = null;
  }
  if (!keepCAD) {
    if (cadWorker !== nativeWorker) cadWorker?.terminate();
    cadWorker = null;
    if (raw) raw.nativeDocumentId = null;
  }
  nativeWorker?.terminate();
  nativeWorker = null;
  nativeReject?.(new DOMException('Cancelled', 'AbortError'));
  nativeReject = null;
  cancelNativeExport();
  for (const { reject } of pending.values())
    reject(new DOMException('Cancelled', 'AbortError'));
  pending.clear();
  if (!keepMesh) loaded = false;
}
function rpc(type, data = {}) {
  if (!worker) {
    worker = new Worker('./worker.js?v=native-step-20261021-4', { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.error) p.reject(Error(data.error));
      else p.resolve(data.result);
    };
    worker.onerror = () => {
      for (const { reject } of pending.values())
        reject(
          Error(
            'Geometry worker could not run. Reload the model and try again.',
          ),
        );
      pending.clear();
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...data });
  });
}
function metrics(target, rows) {
  target.replaceChildren(
    ...rows.flatMap(([key, value]) => {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd');
      dt.textContent = key;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}
function sizeInfo(data) {
  const b =
      data.bounds ??
      new THREE.Box3().setFromBufferAttribute(
        new THREE.BufferAttribute(data.vertices, 3),
      ),
    min = Array.isArray(b.min) ? b.min : b.min.toArray(),
    max = Array.isArray(b.max) ? b.max : b.max.toArray();
  metrics($('model-size'), [
    [
      'Size X × Y × Z',
      max.map((n, i) => (n - min[i]).toFixed(2)).join(' × ') + ' mm',
    ],
    ['Triangles', (data.triangles.length / 3).toLocaleString()],
    ...(data.volume
      ? [['Solid volume', (data.volume / 1000).toFixed(2) + ' cm³']]
      : []),
  ]);
  $('section-z').max = String(Math.max(10, max[2]));
}
function unitScale() {
  return $('units').value === 'auto'
    ? (raw?.unitScale ?? 1)
    : Number($('units').value);
}
async function prepare(demo = false) {
  const turn = epoch;
  setBusy(
    true,
    'Checking closed solids…',
    raw?.nativeBuffer
      ? {
          stage: 4,
          total: 5,
          detail: `${(raw.preview?.triangles ?? 0).toLocaleString()} preview triangles`,
        }
      : undefined,
  );
  try {
    if (raw?.requiresUnits && $('units').value === 'auto')
      throw Error('Choose the FBX source units before detection.');
    const r = await rpc(
      demo ? 'demo' : 'load',
      demo ? { scale: unitScale() } : { geometry: raw, scale: unitScale() },
    );
    if (turn !== epoch) return;
    loaded = true;
    fileState = isDemo ? 'example' : 'loaded';
    original = r.geometry;
    view = 'original';
    $('body').replaceChildren(
      ...r.bodies.map((b) => {
        const option = document.createElement('option');
        option.value = b.index;
        option.textContent = `Part ${b.index + 1} · ${(b.volume / 1000).toFixed(2)} cm³`;
        return option;
      }),
    );
    $('body-control').hidden = r.bodies.length === 1;
    $('body-note').textContent =
      r.bodies.length > 1
        ? `${r.bodies.length} separate solids. Only the selected part is shown and exported.`
        : 'One connected part. Coincident seam vertices are welded; open surfaces are not filled.';
    sizeInfo(original);
    draw();
    resetView();
    await runDetection();
  } catch (e) {
    if (turn !== epoch) return;
    setBusy(false);
    fileState = 'error';
    controls();
    if (e.name !== 'AbortError') status(e.message, true);
  }
}
async function loadFiles(files) {
  if (!files.length) return;
  const models = Array.from(files).filter((f) =>
      extensions.includes(f.name.split('.').at(-1).toLowerCase()),
    ),
    file = models[0];
  if (!file) {
    status(
      'Select a supported model file. Companion files can be included with it.',
      true,
    );
    return;
  }
  epoch++;
  terminate();
  detection = null;
  result = null;
  feet = [];
  selection.clear();
  raw = null;
  loaded = false;
  original = null;
  view = 'original';
  draw();
  isDemo = false;
  fileState = 'opening';
  sourceName = file.name.replace(/\.[^.]+$/, '');
  sourceFormat = file.name.split('.').at(-1).toLowerCase();
  $('part-badge').textContent = 'Uploaded part';
  $('file-info').textContent =
    file.name +
    (models.length > 1
      ? ' · using the first model; select other models separately'
      : '');
  $('units').value = 'auto';
  $('bottom').value = '0';
  $('orientation').value = 'auto';
  $('yaw').value = '0';
  renderFeet();
  const turn = epoch;
  setBusy(
    true,
    'Reading ' + file.name + '…',
    ['step', 'stp', 'brep', 'brp'].includes(sourceFormat)
      ? {
          stage: 1,
          total: 5,
          detail: `${(file.size / 1048576).toFixed(1)} MB file`,
        }
      : undefined,
  );
  try {
    importAbort = new AbortController();
    const imported = await importFile(
      file,
      Array.from(files),
      (w) => {
        if (turn === epoch) cadWorker = w;
      },
      (message, info) => {
        if (turn === epoch) setBusy(true, message, info);
      },
      importAbort.signal,
      (preview) => {
        if (turn !== epoch || original) return;
        earlyPreview = preview;
        host.dataset.preview = 'edges';
        $('viewer-message').hidden = true;
        draw();
        resetView();
        controls();
        performance.mark('step-edge-preview-ready');
      },
    );
    if (turn !== epoch) return;
    earlyPreview = null;
    host.dataset.preview = 'solid';
    raw = imported;
    startNativePreparation();
    $('units-settings').open = Boolean(
      raw.requiresUnits || raw.preview?.adapted,
    );
    $('unit-note').textContent = raw.unitNote;
    original = {
      ...raw,
      vertices: Float32Array.from(raw.vertices, (n) => n * raw.unitScale),
    };
    draw();
    sizeInfo(original);
    resetView();
    await prepare();
  } catch (e) {
    if (turn !== epoch) return;
    fileState = 'error';
    setBusy(false);
    status(e.message, true);
  }
}
async function loadDemo() {
  epoch++;
  terminate();
  raw = null;
  loaded = false;
  isDemo = true;
  fileState = 'example';
  sourceName = 'example-bin';
  sourceFormat = 'demo';
  detection = null;
  result = null;
  feet = [];
  selection.clear();
  $('part-badge').textContent = 'Example';
  $('file-info').textContent = 'Example bin · 2 × 1 cells';
  $('units').value = 'auto';
  $('unit-note').textContent =
    'Generated example in millimetres: one magnet foot and one plain foot.';
  $('orientation').value = 'auto';
  $('yaw').value = '0';
  $('bottom').value = '0';
  renderFeet();
  await prepare(true);
}
async function runDetection() {
  const turn = epoch;
  invalidate();
  setBusy(
    true,
    'Matching foot profiles and the 42 mm grid…',
    busyInfo ? { stage: 5, total: 5 } : undefined,
  );
  try {
    const r = await rpc('detect', {
      bodyIndex: Number($('body').value || 0),
      options: {
        orientation: $('orientation').value,
        yaw: Number($('yaw').value),
        bottom: Number($('bottom').value),
      },
    });
    if (turn !== epoch) return;
    detection = r;
    original = r.geometry;
    feet = r.feet.map((p) => ({ ...p }));
    selection = new Set(feet.filter((p) => p.gridMatch).map((p) => p.id));
    $('grid-x').value = r.grid.x.toFixed(4);
    $('grid-y').value = r.grid.y.toFixed(4);
    $('detection-note').dataset.matched = String(r.grid.matched > 0);
    $('orientation-settings').open = r.grid.matched === 0;
    $('detection-note').textContent = feet.length
      ? `${r.grid.matched} of ${feet.length} profile matches on one 42 mm grid. ` +
        (r.grid.matched === 1
          ? 'Single foot: pitch cannot be measured independently.'
          : `Maximum center residual ${r.grid.maxResidual.toFixed(3)} mm.`)
      : 'No standard male feet detected. Check units and orientation, or place cells manually on the fixed grid. Baseplates and female sockets are not converted.';
    const cells = feet.filter((p) => p.gridMatch);
    const array = cells.length
      ? `${Math.max(...cells.map((p) => p.column)) - Math.min(...cells.map((p) => p.column)) + 1} × ${Math.max(...cells.map((p) => p.row)) - Math.min(...cells.map((p) => p.row)) + 1} cells; ${cells.length} occupied. `
      : '';
    $('summary').textContent =
      array +
      `Aligned base normal: ${r.normal.map((n) => n.toFixed(3)).join(', ')}. Highlighted regions show the replacement height; verify the underside.`;
    setBusy(false);
    status(
      feet.length
        ? 'Feet detected. Choose a style or click Convert feet.'
        : 'No automatic matches. Review orientation or place cells manually.',
    );
    sizeInfo(original);
    renderFeet();
    draw();
    resetView(true);
  } catch (e) {
    if (turn !== epoch) return;
    setBusy(false);
    status(e.message, true);
  }
}
function renderFeet() {
  $('feet').replaceChildren(
    ...feet.map((p) => {
      const tr = document.createElement('tr'),
        cell = document.createElement('td'),
        check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selection.has(p.id);
      check.disabled = busy;
      check.setAttribute(
        'aria-label',
        `Select foot at column ${p.column}, row ${p.row}`,
      );
      check.onchange = () => {
        if (check.checked) selection.add(p.id);
        else selection.delete(p.id);
        invalidate();
        renderFeet();
      };
      const target = document.createElement('label');
      target.className = 'foot-check';
      target.append(check);
      cell.append(target);
      const id = document.createElement('td');
      id.textContent = `${p.column}, ${p.row}`;
      const pos = document.createElement('td');
      pos.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
      const kind = document.createElement('small');
      kind.textContent = p.sourceStyle ?? 'Manual placement';
      pos.append(kind);
      const match = document.createElement('td');
      match.textContent = p.manual
        ? 'Manual'
        : p.gridMatch
          ? `${Math.round(p.confidence * 100)}%`
          : 'Off grid';
      tr.append(cell, id, pos, match);
      return tr;
    }),
  );
  controls();
  drawMarkers();
}
function inputOptions() {
  const o = Object.fromEntries(
    [
      'bottom',
      'height',
      'fit',
      'magnetDiameter',
      'magnetDepth',
      'screwDiameter',
      'screwDepth',
      'roof',
    ].map((k) => [k, Number($(k).value)]),
  );
  o.style = $('style').value;
  o.fitScrewDepth = $('screw-depth-mode').value === 'fit';
  o.feet = feet.filter((p) => selection.has(p.id));
  return o;
}
async function runConversion() {
  if (!canConvert()) return;
  const fields = ['bottom', 'height', 'fit', 'roof'];
  const style = $('style').value;
  if (['magnets', 'both'].includes(style))
    fields.push('magnetDiameter', 'magnetDepth');
  if (['screws', 'both'].includes(style))
    fields.push('screwDiameter', 'screwDepth');
  for (const id of fields) {
    const el = $(id);
    if (!el.value.trim() || !el.checkValidity()) {
      const details = el.closest('details');
      if (details) details.open = true;
      const label = el.closest('label')?.firstChild?.textContent?.trim() || id;
      status(
        `Check ${label}: ${el.validationMessage || 'enter a number.'}`,
        true,
      );
      el.focus();
      el.reportValidity();
      return;
    }
  }
  const turn = epoch;
  result = null;
  setBusy(true, 'Replacing selected feet and checking preserved geometry…');
  try {
    let r;
    if (raw?.nativeBuffer) {
      void nativeExportWarmPool.prewarm();
      const options = conversionParameters(inputOptions());
      options.originalVolume = detection.geometry.volume;
      setBusy(
        true,
        'Replacing native CAD feet and validating the boundary representation…',
      );
      r = await nativeConversion(options);
    } else {
      r = await rpc('convert', { options: inputOptions() });
    }
    if (turn !== epoch) return;
    result = r;
    if (!cadWorker) $('cad-preparation').hidden = true;
    view = 'converted';
    setBusy(false);
    draw();
    status(
      'Conversion ready. ' +
        (r.report.nativeValid
          ? 'Native CAD, closed mesh and preservation checks passed.'
          : 'Closed mesh and preservation checks passed.'),
    );
    if (matchMedia('(max-width: 700px)').matches)
      $('preview-panel').scrollIntoView({ block: 'start' });
    $('conversion-note').textContent =
      `${r.report.feet.length} feet converted to ${STYLES[r.report.style].toLowerCase()} on a fixed 42 mm grid. Exports contain the selected part.` +
      (r.report.sourceCurveRepair
        ? ' Imported CAD curve data was repaired before conversion.'
        : '') +
      (r.brep && r.report.stepExportDeferred
        ? ' BREP preserves the validated native CAD body. STEP translation is checked when requested.'
        : r.brep
        ? ' STEP could not preserve a valid body on reopening. Download BREP for the validated native CAD body, or STL / 3MF for a mesh.'
        : '') +
      (['screws', 'both'].includes(r.report.style)
        ? ` Screw depth: ${r.report.screwDepth} mm${r.report.screwDepth < r.report.requestedScrewDepth ? `, fitted from ${r.report.requestedScrewDepth} mm to retain the solid roof` : ''}.`
        : '') +
      (r.report.displayOnlyMesh
        ? ' The viewer uses a display mesh. STL / 3MF export geometry is generated when you download.'
        : r.report.tessellationDeflectionMM > 0.01
        ? ` STL/3MF mesh deviation: ${r.report.tessellationDeflectionMM} mm (automatically adapted). Native CAD export retains the surfaces.`
        : '');
    metrics($('conversion-metrics'), [
      ['Volume before', (r.report.originalVolume / 1000).toFixed(3) + ' cm³'],
      ['Volume after', (r.report.convertedVolume / 1000).toFixed(3) + ' cm³'],
      [
        'Added / removed',
        r.report.addedVolume.toFixed(2) +
          ' / ' +
          r.report.removedVolume.toFixed(2) +
          ' mm³',
      ],
      [
        'Change outside edit regions',
        r.report.outsideChange.toExponential(2) + ' mm³',
      ],
      ['Closed / connected', 'Passed / 1 solid'],
    ]);
  } catch (e) {
    if (turn !== epoch) return;
    setBusy(false);
    if (e.cleanNativeCancellation) {
      view = 'original';
      draw();
      renderFeet();
      status('Conversion cancelled. Prepared CAD and settings are kept; you can retry now.');
      return;
    }
    status(e.message, true);
  }
}
function preparationStatus(data) {
  nativePreparation = data;
  const note = $('cad-preparation');
  note.hidden = false;
  note.textContent = data.error
    ? data.fatalKernel ? 'CAD preparation stopped. Convert again to reload the original model.'
      : 'CAD preparation needs another check during conversion.'
    : data.done ? 'Native CAD prepared for conversion.'
      : `Preparing native CAD while you review: ${data.progress || 'checking source geometry…'}`;
}
function startNativePreparation() {
  if (!cadWorker || !raw?.nativeDocumentId) return;
  const w = cadWorker;
  preparationStatus({ progress: 'checking source geometry…' });
  w.onmessage = ({ data }) => {
    if (cadWorker !== w || !data.preparation) return;
    preparationStatus(data);
    if (data.fatalKernel) {
      w.terminate();
      cadWorker = null;
      raw.nativeDocumentId = null;
    }
  };
  w.onerror = () => {
    if (cadWorker !== w) return;
    preparationStatus({ error: true });
    w.terminate();
    cadWorker = null;
    raw.nativeDocumentId = null;
  };
  w.postMessage({ type: 'prepare', documentId: raw.nativeDocumentId, bodyIndex: 0 });
}
function nativeConversion(options) {
  return new Promise((resolve, reject) => {
    const turn = epoch;
    const source = raw;
    const requestId = ++sequence;
    const documentId = cadWorker ? source.nativeDocumentId : null;
    const bodyIndex = Number($('body').value || 0);
    const cancelBuffer = documentId && nativePreparation?.done &&
      nativePreparation.report?.bodyIndex === bodyIndex && crossOriginIsolated &&
      typeof SharedArrayBuffer !== 'undefined' ? new SharedArrayBuffer(4) : undefined;
    if (documentId && nativePreparation && !nativePreparation.done && !nativePreparation.error)
      setBusy(true, 'Finishing native CAD preparation before replacing feet…');
    const w = (documentId && cadWorker) || new Worker('./native-worker.js?v=native-step-20261021-4', {
      type: 'module',
    });
    nativeWorker = w;
    nativeReject = reject;
    const cancellation = cancelBuffer ? { token: new Int32Array(cancelBuffer), requested: false, timer: null } : null;
    nativeCancellation = cancellation;
    const current = () => nativeWorker === w && epoch === turn && raw === source;
    const finish = (retain) => {
      clearTimeout(cancellation?.timer);
      if (nativeCancellation === cancellation) nativeCancellation = null;
      if (nativeWorker === w) nativeWorker = null;
      if (nativeReject === reject) nativeReject = null;
      w.onmessage = null;
      w.onerror = null;
      w.onmessageerror = null;
      if (!retain) {
        w.terminate();
        if (cadWorker === w) cadWorker = null;
        source.nativeDocumentId = null;
      } else {
        // An idle worker can still fail while warming its next validator.
        // Drop its document so the next conversion reparses the original bytes.
        w.onerror = w.onmessageerror = () => {
          if (cadWorker !== w || raw !== source) return;
          w.terminate();
          cadWorker = null;
          source.nativeDocumentId = null;
          preparationStatus({ error: true });
        };
      }
    };
    w.onmessage = ({ data }) => {
      if (!current()) return;
      if (data.preparation) {
        preparationStatus(data);
        if (data.fatalKernel) {
          finish(false);
          reject(Error('Native CAD preparation failed. Convert again to reload the original model.'));
          return;
        }
        if (data.progress) setBusy(true, data.progress);
        return;
      }
      if (data.requestId !== requestId) return;
      if (data.progress) {
        if (!cancellation?.requested) setBusy(true, data.progress);
        return;
      }
      if (data.cancelled) {
        const retain = cancellation?.requested && data.clean && documentId && data.nativeDocumentId === documentId;
        finish(retain);
        const error = new DOMException(retain ? 'Conversion cancelled.' : 'Cancellation required a fresh CAD worker.', 'AbortError');
        error.cleanNativeCancellation = Boolean(retain);
        reject(error);
        return;
      }
      // A result already queued when Cancel was clicked must not be published.
      // Without a clean acknowledgment, the cancellation timeout discards it.
      if (cancellation?.requested && data.result) return;
      const retain = !data.error && documentId && data.result?.nativeDocumentId === documentId;
      finish(retain);
      if (data.error)
        reject(Error(data.stage ? `${data.stage.replace(/…$/, '')}: ${data.error}` : data.error));
      else resolve(data.result);
    };
    w.onerror = w.onmessageerror = () => {
      if (!current()) return;
      finish(false);
      reject(Error('Native CAD conversion could not run.'));
    };
    try {
      w.postMessage({
        type: 'convert',
        requestId,
        cancelBuffer,
        documentId,
        retainDocument: Boolean(documentId),
        deferOriginalPose: true,
        fastDisplay: true,
        nativeExportPreference: 'brep',
        buffer: source.nativeBuffer,
        format: source.format,
        scale: unitScale(),
        bodyIndex,
        detection,
        options,
      });
    } catch (error) { finish(false); reject(error); }
  });
}
$('choose-file').onclick = () => $('files').click();
function adjustFit(direction) {
  const input = $('fit');
  const current = Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber
    : 0;
  const hundredths = Math.round(current * 100) + direction * 5;
  input.value = (Math.max(Math.round(Number(input.min) * 100), Math.min(Math.round(Number(input.max) * 100), hundredths)) / 100).toFixed(2);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
$('fit-down').onclick = () => adjustFit(-1);
$('fit-up').onclick = () => adjustFit(1);
$('fit').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    adjustFit(event.key === 'ArrowUp' ? 1 : -1);
  }
});
$('files').onchange = (e) => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  void loadFiles(files);
};
const drop = $('dropzone');
for (const event of ['dragenter', 'dragover'])
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });
for (const event of ['dragleave', 'drop'])
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
  });
drop.addEventListener('drop', (e) => loadFiles(e.dataTransfer.files));
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
$('demo').onclick = loadDemo;
$('detect').onclick = runDetection;
$('convert').onclick = runConversion;
$('workflow-action').onclick = () => {
  if (fileState === 'empty') $('files').click();
  else if (result) $('export-panel').scrollIntoView({ block: 'start' });
  else void runConversion();
};

$('units').onchange = async () => {
  epoch++;
  // Native source geometry is unit-independent; scale a conversion clone later.
  // Only the mesh import/detection needs rebuilding for a new display scale.
  terminate({ preserveIdleCAD: true });
  detection = null;
  invalidate();
  if (isDemo) await prepare(true);
  else if (raw) await prepare();
};
$('body').onchange = runDetection;
for (const id of ['orientation', 'yaw', 'bottom'])
  $(id).oninput = () => {
    detection = null;
    feet = [];
    selection.clear();
    invalidate('Orientation changed. Detect feet again.');
    renderFeet();
  };
for (const id of [
  'style',
  'height',
  'fit',
  'magnetDiameter',
  'magnetDepth',
  'screwDiameter',
  'screwDepth',
  'screw-depth-mode',
  'roof',
])
  $(id).oninput = () => invalidate();
$('select-all').onclick = () => {
  selection = new Set(
    feet.filter((p) => p.gridMatch || p.manual).map((p) => p.id),
  );
  invalidate();
  renderFeet();
};
$('select-none').onclick = () => {
  selection.clear();
  invalidate();
  renderFeet();
};
$('move-grid').onclick = () => {
  if (!detection) return;
  const x = Number($('grid-x').value),
    y = Number($('grid-y').value);
  if (!Number.isFinite(x + y) || Math.max(Math.abs(x), Math.abs(y)) > 2000) {
    status('Use finite grid origin coordinates within ±2000 mm.', true);
    return;
  }
  for (const p of feet) {
    p.x = x + p.column * 42;
    p.y = y + p.row * 42;
    p.gridMatch = true;
  }
  detection.grid = {
    ...detection.grid,
    x,
    y,
    matched: feet.length,
    total: feet.length,
  };
  invalidate(
    'Grid origin changed. Verify the foot positions before converting.',
  );
  renderFeet();
};
$('add-cell').onclick = () => {
  if (!detection) return;
  const x = detection.grid.x,
    y = detection.grid.y,
    column = Number($('column').value),
    row = Number($('row').value);
  if (
    Math.abs(Number($('grid-x').value) - x) > 0.0001 ||
    Math.abs(Number($('grid-y').value) - y) > 0.0001
  ) {
    status('Apply the grid origin before adding a cell.', true);
    return;
  }
  if (
    !Number.isFinite(x + y) ||
    !Number.isInteger(column) ||
    !Number.isInteger(row) ||
    Math.max(Math.abs(column), Math.abs(row)) > 48
  ) {
    status(
      'Enter a valid grid origin and integer column/row within ±48.',
      true,
    );
    return;
  }
  if (feet.some((p) => p.column === column && p.row === row)) {
    status('That grid cell is already listed. Select its checkbox.', true);
    return;
  }
  if (feet.length >= LIMITS.feet) {
    status('Maximum 128 foot cells.', true);
    return;
  }
  const id = Math.max(0, ...feet.map((p) => p.id)) + 1;
  feet.push({
    id,
    x: x + column * 42,
    y: y + row * 42,
    column,
    row,
    manual: true,
    gridMatch: true,
    confidence: 0,
  });
  selection.add(id);
  invalidate();
  renderFeet();
};
$('cancel').onclick = () => {
  if (exportWorker || exportAbort) {
    cancelNativeExport();
    setBusy(false);
    status('Download preparation cancelled. Your conversion is still available.');
    return;
  }
  if (nativeCancellation) {
    if (nativeCancellation.requested) return;
    const cancellation = nativeCancellation;
    cancellation.requested = true;
    Atomics.store(cancellation.token, 0, 1);
    setBusy(true, 'Cancelling the current CAD step and cleaning up…');
    cancellation.timer = setTimeout(() => {
      if (nativeCancellation !== cancellation) return;
      nativeCancellation = null;
      $('cancel').onclick();
    }, 8000);
    return;
  }
  const retryNative = Boolean(nativeWorker && raw?.nativeBuffer?.byteLength && loaded && detection);
  fileState = retryNative ? 'loaded' : 'cancelled';
  epoch++;
  terminate({ preserveLoadedMesh: retryNative });
  setBusy(false);
  result = null;
  if (!retryNative) {
    detection = null;
    feet = [];
    selection.clear();
  }
  view = 'original';
  draw();
  renderFeet();
  controls();
  status(
    retryNative
      ? 'Conversion cancelled. Your model and settings are kept. Click Convert feet to retry; native CAD will be prepared again.'
      : 'Cancelled. Reload the example or choose the model again to continue.',
  );
};
for (const key of ['original', 'converted', 'changes'])
  $('view-' + key).onclick = () => {
    if (key !== 'original' && !result) return;
    view = key;
    draw();
  };
$('underside').onclick = () => resetView(true);
$('reset-view').onclick = () => resetView();
function section() {
  requestRender();
  plane.constant = Number($('section-z').value);
  $('section-value').value = plane.constant.toFixed(1);
  clips.splice(0, clips.length, ...($('section').checked ? [plane] : []));
  scene.traverse((o) => {
    for (const m of [].concat(o.material ?? []))
      if (m.clippingPlanes === clips) m.needsUpdate = true;
  });
}
$('section').onchange = () => {
  section();
  controls();
};
$('section-z').oninput = section;
function download(bytes, type, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  status('Download requested: ' + name);
}
function exported(geometry = result.geometry) {
  const data = $('source-pose').checked
    ? restoreCoordinates(geometry, detection)
    : geometry;
  checkMesh(data);
  return data;
}
function report() {
  return {
    version: 1,
    source: {
      name: sourceName,
      format: sourceFormat,
      coordinateScale: unitScale(),
      partIndex: Number($('body').value || 0),
    },
    orientation: {
      rotation: detection.rotation,
      translation: detection.translation,
      output: $('source-pose').checked ? 'source-mm' : 'base-down-mm',
    },
    detection: { grid: detection.grid, normal: detection.normal },
    conversion: result.report,
    qualification:
      'Digital geometry checks only. Physical fit, strength and printability require testing.',
  };
}
function filename(ext) {
  return sourceName + '-' + result.report.style + '-42mm.' + ext;
}
function prepareNativeExport(data) {
  const abort = new AbortController();
  exportAbort = abort;
  return new Promise((resolve, reject) => {
    exportReject = reject;
    let w, lease;
    const verifierExport = data.type === 'pose' && data.format === 'brep' && data.requestedFormat === 'step';
    const finish = () => {
      if (lease) lease.release();
      else w?.terminate();
      if (exportAbort === abort) {
        exportWorker = null;
        exportReject = null;
        exportAbort = null;
      }
    };
    (async () => {
      if (verifierExport) {
        lease = await nativeExportWarmPool.acquire({ signal: abort.signal });
        w = lease.worker;
      } else w = new Worker('./native-export-worker.js?v=native-step-20261021-4', { type: 'module' });
      if (abort.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      exportWorker = w;
      w.onmessage = ({ data: reply }) => {
        if (exportWorker !== w || abort.signal.aborted) return;
        if (reply.warm) return;
        if (reply.progress) {
          setBusy(true, reply.progress);
          return;
        }
        if (reply.result?.report && lease) reply.result.report.exportWarmup = {
          prewarmed: lease.prewarmed, warmupMS: lease.warmupMS,
        };
        finish();
        if (reply.error) reject(Error(reply.stage ? `${reply.stage}: ${reply.error}` : reply.error));
        else {
          resolve(reply.result);
          if (verifierExport && raw?.nativeBuffer) void nativeExportWarmPool.prewarm();
        }
      };
      w.onerror = w.onmessageerror = () => {
        finish();
        reject(Error('Native export preparation could not run.'));
      };
      w.postMessage(data);
    })().catch(error => { finish(); reject(error); });
  });
}
async function exportMesh() {
  const target = result;
  if (!result.report.displayOnlyMesh) return result.geometry;
  if (!result.exportGeometry) {
    const prepared = await prepareNativeExport({
      type: 'mesh',
      buffer: result.brep || result.step,
      format: result.report.nativeExportFormat,
    });
    if (result !== target) throw new DOMException('Cancelled', 'AbortError');
    result.exportGeometry = prepared.geometry;
    result.report.meshExport = prepared.report;
  }
  return result.exportGeometry;
}
async function downloadMesh(format) {
  if (!result || busy) return;
  const turn = epoch;
  setBusy(true, 'Preparing download geometry…');
  try {
    const geometry = exported(await exportMesh());
    download(
      format === 'stl' ? binarySTL(geometry) : export3MF(geometry, report()),
      format === 'stl' ? 'model/stl' : 'model/3mf',
      filename(format),
    );
  } catch (e) {
    if (e.name !== 'AbortError') status(e.message, true);
  } finally {
    if (turn === epoch) setBusy(false);
  }
}
$('stl').onclick = () => downloadMesh('stl');
$('three-mf').onclick = () => downloadMesh('3mf');
$('step').onclick = async () => {
  if (!(result?.step || result?.brep) || busy) return;
  const turn = epoch, target = result;
  setBusy(true, 'Preparing native CAD download…');
  try {
    let bytes = result.brep || result.step;
    let format = result.brep ? 'brep' : 'step';
    if ($('source-pose').checked) {
      if (result.originalPoseExport?.deferred && !result.preparedSourceExport) {
        const prepared = await prepareNativeExport({
          type: 'pose',
          buffer: bytes,
          format,
          ...result.originalPoseExport,
        });
        if (result !== target) throw new DOMException('Cancelled', 'AbortError');
        result.preparedSourceExport = prepared;
        result.report.originalPoseExport = result.preparedSourceExport.report;
      }
      if (result.preparedSourceExport) {
        bytes = result.preparedSourceExport.buffer;
        format = result.preparedSourceExport.format;
      } else {
        bytes = result.sourceBrep || result.sourceStep;
        format = result.sourceBrep ? 'brep' : 'step';
      }
    }
    if (!bytes) throw Error('Native export is not available for this orientation.');
    download(bytes, format === 'brep' ? 'application/octet-stream' : 'application/step', filename(format));
  } catch (e) {
    if (e.name !== 'AbortError') status(e.message, true);
  } finally {
    if (turn === epoch) setBusy(false);
  }
};
$('translate-step').onclick = async () => {
  if (!result?.brep || busy) return;
  const turn = epoch, target = result;
  const originalPose = $('source-pose').checked;
  const cacheKey = originalPose ? 'translatedSourceStep' : 'translatedBaseStep';
  setBusy(true, 'Translating and validating STEP…');
  try {
    let prepared = result[cacheKey];
    if (!prepared) {
      prepared = await prepareNativeExport({
        type: 'pose', buffer: result.brep, format: 'brep', requestedFormat: 'step',
        outputPose: originalPose ? 'original' : 'base-down',
        sourceCertificate: result.sourceCertificate,
        transform: originalPose ? result.originalPoseExport.transform : {
          rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0],
        },
        preferredSurfaceCurves: result.report.sourceCurveRepair ? 'preserved' : undefined,
      });
      if (result !== target) throw new DOMException('Cancelled', 'AbortError');
    }
    result.report[cacheKey] = prepared.report;
    if (prepared.format !== 'step') {
      const reason = prepared.report?.stepExportError || 'The reopened file did not pass validation.';
      status(`STEP translation failed validation: ${reason} Download BREP remains available for the validated native CAD body.`, true);
      return;
    }
    result[cacheKey] = prepared;
    download(prepared.buffer, 'application/step', filename('step'));
  } catch (e) {
    if (e.name !== 'AbortError') status(e.message, true);
  } finally { if (turn === epoch) setBusy(false); }
};
$('report').onclick = () => {
  if (result)
    download(
      JSON.stringify(report(), null, 2) + '\n',
      'application/json',
      filename('json'),
    );
};
function syncWorkflowHeight() {
  document.documentElement.style.setProperty(
    '--workflow-height',
    $('workflow').offsetHeight + 'px',
  );
}
new ResizeObserver(syncWorkflowHeight).observe($('workflow'));
const viewerColumn = document.querySelector('.viewer-column');
new ResizeObserver(() => {
  viewerColumn.style.setProperty(
    '--viewer-column-height',
    viewerColumn.offsetHeight + 'px',
  );
}).observe(viewerColumn);

for (const link of document.querySelectorAll('[data-stage]')) {
  link.addEventListener('click', () => {
    requestAnimationFrame(() => {
      syncWorkflowHeight();
      document
        .querySelector(link.getAttribute('href'))
        .scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  });
}
setBusy(false);
status('Choose your model or try the example bin to begin.');
$('viewer-message').textContent = 'Choose a model to preview it here.';
$('viewer-message').hidden = false;
