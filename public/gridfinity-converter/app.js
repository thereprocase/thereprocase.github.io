import * as THREE from 'three';
import { OrbitControls } from '/p1s-feet/vendor/OrbitControls.js';
import {
  STYLES,
  LIMITS,
  binarySTL,
  restoreCoordinates,
  checkMesh,
} from './kernel.js?v=step-audit-1';
import {
  importFile,
  extensions,
  export3MF,
} from './importers.js?v=cad-preview-1';
const $ = (id) => document.getElementById(id),
  host = $('viewer');
let worker,
  cadWorker,
  nativeWorker,
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
  sourceName = 'example-bin',
  sourceFormat = 'demo',
  view = 'original',
  isDemo = false;
let fileState = 'empty';
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
scene.background = new THREE.Color('#eee9dc');
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100000);
camera.up.set(0, 0, 1);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x596064, 2.3));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(150, -200, 300);
scene.add(light);
const root = new THREE.Group(),
  markers = new THREE.Group();
scene.add(root, markers);
const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 7),
  clips = [];
const bands = new THREE.DataTexture(
  new Uint8Array([95, 165, 225, 255]),
  4,
  1,
  THREE.RedFormat,
);
bands.magFilter = THREE.NearestFilter;
bands.minFilter = THREE.NearestFilter;
bands.needsUpdate = true;
const grid = new THREE.GridHelper(252, 6, 0x697b80, 0xc0c3bc);
grid.rotation.x = Math.PI / 2;
grid.position.z = -0.08;
scene.add(grid);
function clearGroup(group) {
  for (const o of group.children.slice()) {
    group.remove(o);
    o.traverse((n) => {
      n.geometry?.dispose();
      [].concat(n.material ?? []).forEach((m) => m.dispose());
    });
  }
}
function modelMesh(data, color = 0x5da3ad, opacity = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
  g.setIndex(new THREE.BufferAttribute(data.triangles, 1));
  g.computeVertexNormals();
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: bands,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    clippingPlanes: clips,
    depthWrite: opacity === 1,
  });
  const mesh = new THREE.Mesh(g, material);
  if (data.triangles.length < 600000 && opacity === 1) {
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(g, 32),
        new THREE.LineBasicMaterial({ color: 0x273c40, clippingPlanes: clips }),
      ),
    );
  }
  return mesh;
}
function draw() {
  document.body.dataset.view = view;
  $('legend-selected').textContent =
    view === 'changes' ? 'Added material' : 'Selected foot';
  $('legend-unselected').textContent =
    view === 'changes' ? 'Removed material' : 'Unselected foot';
  clearGroup(root);
  const data = view === 'original' || !result ? original : result.geometry;
  if (data) {
    root.add(
      modelMesh(
        data,
        view === 'changes' ? 0x98a3a4 : 0x5da3ad,
        view === 'changes' ? 0.22 : 1,
      ),
    );
    if (view === 'changes') {
      if (result.added.triangles.length)
        root.add(modelMesh(result.added, 0x008a91));
      if (result.removed.triangles.length)
        root.add(modelMesh(result.removed, 0xee8138, 0.85));
    }
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
        color: selected ? 0x008c96 : 0xf08b38,
        transparent: true,
        opacity: selected ? 0.16 : 0.08,
        depthWrite: false,
        side: THREE.DoubleSide,
        clippingPlanes: clips,
      }),
      mesh = new THREE.Mesh(g, m);
    mesh.position.set(p.x, p.y, bottom + height / 2);
    mesh.userData.footId = p.id;
    const e = new THREE.LineSegments(
      new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({
        color: selected ? 0x006f7a : 0xd4651e,
        depthTest: false,
        clippingPlanes: clips,
      }),
    );
    mesh.add(e);
    markers.add(mesh);
  }
}
function resetView(under = false) {
  if (!original) return;
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
        : new THREE.Vector3(1, -1, 0.85).normalize().multiplyScalar(d),
    );
  camera.near = Math.max(0.01, d / 10000);
  camera.far = d * 50;
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
      ? 'Native BREP · STEP export did not pass validation'
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
    : 'Load a model to detect its male feet';
  $('section-z').disabled = !$('section').checked;
}
function setBusy(value, message) {
  if (value && !busy) {
    busyStarted = performance.now();
    const tick = () => {
      const seconds = Math.floor((performance.now() - busyStarted) / 1000);
      $('loading-elapsed').textContent =
        `Elapsed ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · Processing on this device`;
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
  $('viewer-message').hidden = !value;
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
function terminate() {
  importAbort?.abort();
  importAbort = null;
  worker?.terminate();
  worker = null;
  cadWorker?.terminate();
  cadWorker = null;
  nativeWorker?.terminate();
  nativeWorker = null;
  for (const { reject } of pending.values())
    reject(new DOMException('Cancelled', 'AbortError'));
  pending.clear();
  loaded = false;
}
function rpc(type, data = {}) {
  if (!worker) {
    worker = new Worker('./worker.js?v=step-audit-1', { type: 'module' });
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
  setBusy(true, 'Checking closed solids…');
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
  setBusy(true, 'Reading ' + file.name + '…');
  try {
    importAbort = new AbortController();
    const imported = await importFile(
      file,
      Array.from(files),
      (w) => {
        if (turn === epoch) cadWorker = w;
      },
      (message) => {
        if (turn === epoch) setBusy(true, message);
      },
      importAbort.signal,
    );
    if (turn !== epoch) return;
    raw = imported;
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
  setBusy(true, 'Matching foot profiles and the 42 mm grid…');
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
    let r = await rpc('convert', { options: inputOptions() });
    if (turn !== epoch) return;
    if (raw?.nativeBuffer) {
      setBusy(
        true,
        'Replacing native CAD feet and validating the boundary representation…',
      );
      r = await nativeConversion(r.report);
      if (turn !== epoch) return;
    }
    result = r;
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
      (r.brep
        ? ' STEP could not preserve a valid body on reopening. Download BREP for the validated native CAD body, or STL / 3MF for a mesh.'
        : '') +
      (['screws', 'both'].includes(r.report.style)
        ? ` Screw depth: ${r.report.screwDepth} mm${r.report.screwDepth < r.report.requestedScrewDepth ? `, fitted from ${r.report.requestedScrewDepth} mm to retain the solid roof` : ''}.`
        : '') +
      (r.report.tessellationDeflectionMM > 0.01
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
    status(e.message, true);
  }
}
function nativeConversion(options) {
  return new Promise((resolve, reject) => {
    const w = new Worker('./native-worker.js?v=cad-consistency-1', {
      type: 'module',
    });
    nativeWorker = w;
    w.onmessage = ({ data }) => {
      if (nativeWorker !== w) return;
      if (data.progress) {
        status(data.progress);
        $('viewer-message').textContent = data.progress;
        return;
      }
      w.terminate();
      if (nativeWorker === w) nativeWorker = null;
      if (data.error) reject(Error(data.error));
      else resolve(data.result);
    };
    w.onerror = () => {
      w.terminate();
      reject(Error('Native CAD conversion could not run.'));
    };
    w.postMessage({
      buffer: raw.nativeBuffer,
      format: raw.format,
      scale: unitScale(),
      bodyIndex: Number($('body').value || 0),
      detection,
      options,
    });
  });
}
$('choose-file').onclick = () => $('files').click();
function adjustFit(direction) {
  const input = $('fit');
  const current = Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber
    : 0;
  const hundredths = Math.round(current * 100) + direction * 5;
  input.value = (Math.max(-50, Math.min(50, hundredths)) / 100).toFixed(2);
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
  terminate();
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
  fileState = 'cancelled';
  epoch++;
  terminate();
  setBusy(false);
  result = null;
  detection = null;
  feet = [];
  selection.clear();
  view = 'original';
  draw();
  renderFeet();
  controls();
  status(
    'Cancelled. Reload the example or choose the model again to continue.',
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
function exported() {
  const data = $('source-pose').checked
    ? restoreCoordinates(result.geometry, detection)
    : result.geometry;
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
$('stl').onclick = () => {
  try {
    if (result) download(binarySTL(exported()), 'model/stl', filename('stl'));
  } catch (e) {
    status(e.message + ' Try base-down coordinates.', true);
  }
};
$('three-mf').onclick = () => {
  try {
    if (result)
      download(export3MF(exported(), report()), 'model/3mf', filename('3mf'));
  } catch (e) {
    status(e.message + ' Try base-down coordinates.', true);
  }
};
$('step').onclick = () => {
  if (result?.step || result?.brep) {
    const brep = Boolean(result.brep);
    download(
      $('source-pose').checked
        ? brep
          ? result.sourceBrep
          : result.sourceStep
        : brep
          ? result.brep
          : result.step,
      brep ? 'application/octet-stream' : 'application/step',
      filename(brep ? 'brep' : 'step'),
    );
  }
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
