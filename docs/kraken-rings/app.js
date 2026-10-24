import * as THREE from 'three';
import {OrbitControls} from '/p1s-feet/vendor/OrbitControls.js';
import {demandRenderer, taskWorker} from '../gridfinity-common/generator-runtime.js?v=runtime-3';
import {readSettingsLink, settingsURL, copySettingsLink} from '../gridfinity-common/settings-link.js?v=share-1';
import {ringParameters, nutParameters, gearParameters, ringDefaults, nutDefaults, gearDefaults, gearPresets, ringStem, mm} from './kernel.js?v=rings-2';
import {ringDiagram, gearDiagram} from './diagram.js?v=rings-2';

const $ = id => document.getElementById(id);
const WORKER = './worker.js?v=rings-2', PETG = 1.26;
const gearKeys = ['plain', 'count', 'pad', 'root', 'tip', 'outer', 'fillet'];
const linkDefaults = {...ringDefaults, flange: nutDefaults.flange, ...Object.fromEntries(gearKeys.map(k => ['gear_' + k, gearDefaults[k]]))};
const state = {ring: null, nut: null, ringJob: null, nutJob: null, nutStarted: false};

function download(bytes, type, name) {
  const url = URL.createObjectURL(new Blob([bytes], {type})), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function facts(el, rows) {
  el.replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
}
const dia = x => `Ø${mm(Math.round(x * 100) / 100)} mm`;

// ---- Preview: toon shading on a 10 mm bed grid, as the gridfinity generators.
const bands = new THREE.DataTexture(new Uint8Array([90, 155, 220, 255]), 4, 1, THREE.RedFormat);
bands.needsUpdate = true; bands.magFilter = bands.minFilter = THREE.NearestFilter;
function viewer(host, note, elevation = .95, distance = 1) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias: true}); } catch { note.textContent = '3D preview unavailable in this browser. The diagram and downloads still work.'; return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#eee9dc');
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 5000); camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(120, -260, 400); scene.add(light);
  const loop = demandRenderer({renderer, controls, scene, camera, host});
  let group;
  return {
    show(parts, pose = true) {
      if (group) { scene.remove(group); group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
      group = new THREE.Group();
      const box = new THREE.Box3();
      for (const {vertices, triangles, color, offset, material} of parts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); g.setIndex(new THREE.BufferAttribute(triangles, 1)); g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, material ?? new THREE.MeshToonMaterial({color, gradientMap: bands}));
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), new THREE.LineBasicMaterial({color: 0x273c40})));
        mesh.position.set(offset, 0, 0); group.add(mesh); box.expandByObject(mesh);
      }
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const w = Math.ceil((size.x + 20) / 10) * 10, d = Math.ceil((size.y + 20) / 10) * 10;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({color: 0xdfe3e2, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1}));
      plate.position.set(c.x, c.y, -.05); group.add(plate);
      const lines = [];
      for (let x = -w / 2; x <= w / 2 + 1e-6; x += 10) lines.push(c.x + x, c.y - d / 2, 0, c.x + x, c.y + d / 2, 0);
      for (let y = -d / 2; y <= d / 2 + 1e-6; y += 10) lines.push(c.x - w / 2, c.y + y, 0, c.x + w / 2, c.y + y, 0);
      const grid = new THREE.BufferGeometry(); grid.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
      group.add(new THREE.LineSegments(grid, new THREE.LineBasicMaterial({color: 0x9aa5a3})));
      scene.add(group);
      if (pose) { const r = Math.max(size.x, size.y) * .95 * distance * Math.max(1, 1.5 / camera.aspect); /* narrow viewers need more distance */ controls.target.copy(c); camera.position.set(c.x + r * .2, c.y - r * 1.1, c.z + r * elevation); camera.far = r * 20; camera.updateProjectionMatrix(); controls.update(); }
      note.hidden = true; loop.request();
    },
    note(text) { note.textContent = text; note.hidden = !text; },
  };
}
const ringView = viewer($('ring-viewer'), $('ring-note'));
// A lower camera shows the added slab's edge under the original flange.
const nutView = viewer($('nut-viewer'), $('nut-note'), .45);
const gearView = viewer($('gear-viewer'), $('gear-note'), .8, 1.25);
const viewNote = (view, el, text) => { if (view) view.note(text); else if (!el.textContent.includes('unavailable')) el.textContent = text; };

// Colour the nut's added slab (below the original outer face) orange.
function nutMaterial(added) {
  const m = new THREE.MeshToonMaterial({color: 0x5da3ad, gradientMap: bands});
  m.onBeforeCompile = shader => {
    shader.uniforms.slabTop = {value: added};
    shader.vertexShader = 'varying float nutZ;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nnutZ=position.z;');
    shader.fragmentShader = 'uniform float slabTop;varying float nutZ;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif(nutZ<slabTop-1e-3) diffuseColor.rgb=vec3(0.91,0.64,0.37);');
  };
  return m;
}

// ---- Rings
const ringForm = $('ring-form');
// Phones get the stacked layout; the wide drawing would shrink its labels below legibility.
let diagramParams, diagramNarrow;
const narrowDiagram = () => $('diagram').clientWidth < 640;
function drawDiagram(p) { diagramParams = p; diagramNarrow = narrowDiagram(); $('diagram').innerHTML = ringDiagram(p, {narrow: diagramNarrow}); }
new ResizeObserver(() => { if (diagramParams && narrowDiagram() !== diagramNarrow) drawDiagram(diagramParams); }).observe($('diagram'));
const ringInput = () => ({hole: Number($('hole').value), bite: Number($('bite').value), clearance: Number($('clearance').value)});
function ringError(message, field) {
  for (const id of ['hole', 'bite', 'clearance']) $(id).removeAttribute('aria-invalid');
  $('ring-error').hidden = !message; $('ring-error').textContent = message ?? '';
  if (message && field) $(field).setAttribute('aria-invalid', 'true');
}
function ringField(message) { return /bite/i.test(message) ? 'bite' : /undersize/i.test(message) ? 'clearance' : 'hole'; }
function stockHint(p) {
  if (p.hole === 55.5) return 'Same geometry as the published Polymaker 55.5 mm pair above.';
  if (p.hole === 53.4) return 'Same geometry as the published Elegoo 53.4 mm pair above.';
  if (p.hole === p.stock) return `Same geometry as the ready-made ${p.stock} mm pair above.`;
  return `For a ${mm(p.hole)} mm reading, the ready-made ${p.stock} mm pair also fits (${mm(Math.round((p.hole - p.stock) * 10) / 10)} mm smaller). This size uses its holder core.`;
}
function ringFacts(p, r) {
  const rows = [['Support core', dia(2 * p.support)], ['Pentagon points', dia(2 * p.corner)], ['Flange OD · gear side', dia(p.flangeOD)], ['Cap lip', dia(p.lipDiameter)],
    ['Height · gear / cap', '11.5 / 10.4 mm'], ['Holder core from', `humebeam ${p.stock} mm`]];
  // Solid-body mass; a sliced part with sparse infill weighs less.
  if (r) rows.push(['Gear side · solid PETG', `${(r.parts['gear-side-1.5mm-flange'].volume * PETG / 1000).toFixed(1)} g`], ['Cap side · solid PETG', `${(r.parts['cap-side'].volume * PETG / 1000).toFixed(1)} g`]);
  facts($('ring-facts'), rows);
}
let ringTimer;
function ringChanged({immediate = false} = {}) {
  clearTimeout(ringTimer); state.ringJob?.terminate(); state.ring = null;
  for (const id of ['dl-gear', 'dl-cap', 'dl-zip']) $(id).disabled = true;
  let p;
  try { p = ringParameters(ringInput()); } catch (e) {
    // Let people finish typing before flagging a partial number.
    ringTimer = setTimeout(() => { ringError(e.message, ringField(e.message)); $('ring-status').textContent = 'Fix the highlighted value to generate.'; }, immediate ? 0 : 700);
    return;
  }
  ringError(); drawDiagram(p); $('stock-hint').textContent = stockHint(p); ringFacts(p);
  $('ring-status').textContent = `Generating ${mm(p.hole)} mm pair…`;
  ringTimer = setTimeout(() => generateRings(p), immediate ? 0 : 350);
}
function generateRings(p) {
  state.ringJob?.terminate();
  viewNote(ringView, $('ring-note'), state.ringShown ? 'Previous size shown · building the new pair…' : 'Building the ring pair in your browser…');
  const job = state.ringJob = taskWorker(WORKER, $('ring-status'));
  job.onmessage = ({data}) => {
    job.terminate(); if (state.ringJob !== job) return;
    if (data.error) { $('ring-status').textContent = 'Generation failed: ' + data.error; viewNote(ringView, $('ring-note'), 'Generation failed · see the message beside the settings.'); return; }
    const r = state.ring = data.result, gear = r.parts['gear-side-1.5mm-flange'], cap = r.parts['cap-side'];
    for (const id of ['dl-gear', 'dl-cap', 'dl-zip']) $(id).disabled = false;
    $('ring-status').textContent = `${mm(r.parameters.hole)} mm pair ready · checked as closed solids`;
    ringFacts(r.parameters, r);
    const gx = gear.bounds[3], cx = cap.bounds[3];
    ringView?.show([{...gear, color: 0xe8a45f, offset: -gx - 4}, {...cap, color: 0x5da3ad, offset: cx + 4}], !state.ringShown);
    state.ringShown = true;
    if (!state.nutStarted && nutVisible) startNut();
  };
  job.onerror = () => { job.terminate(); $('ring-status').textContent = 'The geometry engine could not start. Reload the page; this needs a browser with WebAssembly and module workers.'; };
  job.postMessage({kind: 'rings', parameters: {hole: p.hole, bite: p.bite, clearance: p.clearance}});
}
ringForm.addEventListener('input', () => ringChanged());
ringForm.addEventListener('submit', e => { e.preventDefault(); ringChanged({immediate: true}); });
ringForm.addEventListener('change', e => { if (e.target.type === 'number') ringChanged({immediate: true}); });
for (const b of ringForm.querySelectorAll('[data-step]')) b.onclick = () => {
  const v = Math.round((Number($('hole').value || ringDefaults.hole) + Number(b.dataset.step)) * 10) / 10;
  $('hole').value = Math.min(95, Math.max(45, v)).toFixed(1); ringChanged();
};
$('reset-fit').onclick = () => { $('bite').value = ringDefaults.bite; $('clearance').value = ringDefaults.clearance; ringChanged({immediate: true}); };
const pairName = () => ringStem(state.ring.parameters, 'pair') + '.zip';
$('dl-gear').onclick = () => { const x = state.ring?.parts['gear-side-1.5mm-flange']; if (x) download(x.stl, 'model/stl', x.stem + '.stl'); };
$('dl-cap').onclick = () => { const x = state.ring?.parts['cap-side']; if (x) download(x.stl, 'model/stl', x.stem + '.stl'); };
$('dl-zip').onclick = () => { if (state.ring) download(state.ring.zip, 'application/zip', pairName()); };

// ---- Nut
const nutInput = () => ({flange: Number($('flange').value)});
let nutTimer, nutVisible = false;
function nutChanged({immediate = false} = {}) {
  clearTimeout(nutTimer); state.nutJob?.terminate(); state.nut = null; $('dl-nut').disabled = true;
  let p;
  try { p = nutParameters(nutInput()); } catch (e) {
    nutTimer = setTimeout(() => { $('nut-error').hidden = false; $('nut-error').textContent = e.message; $('flange').setAttribute('aria-invalid', 'true'); $('nut-status').textContent = 'Fix the flange thickness to generate.'; }, immediate ? 0 : 700);
    return;
  }
  $('nut-error').hidden = true; $('flange').removeAttribute('aria-invalid');
  nutFacts(p);
  $('nut-status').textContent = `Generating ${mm(p.flange)} mm flange nut…`;
  nutTimer = setTimeout(() => generateNut(p), immediate ? 0 : 350);
}
function nutFacts(p, r) {
  const perMM = 5.794; // cm3 of flange per added mm, measured from the 7.5 mm build
  const grams = r ? r.addedGrams : p.added * perMM * PETG;
  facts($('nut-facts'), [['Added on outer face', `${mm(p.added)} mm`], ['Spool width lost', `${mm(p.added)} mm`],
    ['Extra PETG · solid', `${r ? '' : '≈ '}${grams.toFixed(1)} g`], ['Nut height', `${mm(Math.round((11.9 + p.added) * 10) / 10)} mm`],
    ...(r ? [['Whole nut · solid PETG', `${(r.part.volume * PETG / 1000).toFixed(1)} g`]] : [])]);
}
function generateNut(p) {
  state.nutStarted = true; state.nutJob?.terminate();
  viewNote(nutView, $('nut-note'), state.nutShown ? 'Previous nut shown · building…' : 'Building the nut in your browser…');
  const progress = document.getElementById('task-progress'); if (progress) $('nut-status').after(progress);
  const job = state.nutJob = taskWorker(WORKER, $('nut-status'));
  job.onmessage = ({data}) => {
    job.terminate(); if (state.nutJob !== job) return;
    if (data.error) { $('nut-status').textContent = 'Generation failed: ' + data.error; viewNote(nutView, $('nut-note'), 'Generation failed · see the message beside the settings.'); return; }
    const r = state.nut = data.result; $('dl-nut').disabled = false;
    $('nut-status').textContent = `${mm(r.parameters.flange)} mm flange nut ready · checked as one closed solid`;
    nutFacts(r.parameters, r);
    nutView?.show([{...r.part, offset: 0, material: nutMaterial(r.parameters.added)}], !state.nutShown); state.nutShown = true;
  };
  job.onerror = () => { job.terminate(); $('nut-status').textContent = 'The geometry engine could not start. Reload the page; this needs a browser with WebAssembly and module workers.'; };
  job.postMessage({kind: 'nut', parameters: {flange: p.flange}});
}
function startNut() { if (!state.nutStarted) nutChanged({immediate: true}); }
$('nut-form').addEventListener('input', () => nutChanged());
$('nut-form').addEventListener('submit', e => { e.preventDefault(); nutChanged({immediate: true}); });
$('nut-form').addEventListener('change', () => nutChanged({immediate: true}));
for (const b of $('nut-form').querySelectorAll('[data-step]')) b.onclick = () => {
  const v = Math.round((Number($('flange').value || nutDefaults.flange) + Number(b.dataset.step)) * 10) / 10;
  $('flange').value = Math.min(7.5, Math.max(1.5, v)).toFixed(1); nutChanged();
};
$('dl-nut').onclick = () => { if (state.nut) download(state.nut.part.stl, 'model/stl', state.nut.part.stem + '.stl'); };
// The nut builds when its section comes into view, or right after the rings when it already is.
new IntersectionObserver(entries => { nutVisible = entries.some(e => e.isIntersecting); if (nutVisible && state.ring) startNut(); }, {rootMargin: '200px'}).observe($('nut'));

// ---- Settings link (URL fragment only)
$('share').onclick = async () => {
  try {
    const g = gearInput(); gearParameters(g);
    const input = {...ringInput(), ...nutInput(), ...Object.fromEntries(gearKeys.map(k => ['gear_' + k, g[k]]))}; ringParameters({hole: input.hole, bite: input.bite, clearance: input.clearance}); nutParameters({flange: input.flange});
    const url = settingsURL(location.href, 'kraken-rings', input); $('share-url').value = url;
    const copied = await copySettingsLink(url); $('share-url').hidden = copied;
    $('share-status').textContent = copied ? 'Settings link copied.' : 'Copy the settings link below.';
    if (!copied) { $('share-url').focus(); $('share-url').select(); }
  } catch (e) { $('share-status').textContent = 'Fix the highlighted value first: ' + e.message; }
};
function restore() {
  try {
    const linked = readSettingsLink(location.href, 'kraken-rings', linkDefaults); if (!linked) return false;
    const {flange, ...rest} = linked.parameters, ring = {hole: rest.hole, bite: rest.bite, clearance: rest.clearance}, gear = Object.fromEntries(gearKeys.map(k => [k, rest['gear_' + k]]));
    ringParameters(ring); nutParameters({flange}); gearParameters(gear); setGearInputs(gear);
    $('hole').value = ring.hole.toFixed(1); $('bite').value = ring.bite; $('clearance').value = ring.clearance; $('flange').value = flange.toFixed(1);
    if (ring.bite !== ringDefaults.bite || ring.clearance !== ringDefaults.clearance) $('advanced').open = true;
    $('share-status').textContent = 'Settings restored from link.'; return true;
  } catch (e) { $('share-status').textContent = 'Could not load settings link: ' + e.message + ' Showing defaults.'; return false; }
}
addEventListener('hashchange', () => { if (restore()) { ringChanged({immediate: true}); if (state.nutStarted) nutChanged({immediate: true}); gearChanged({immediate: true, build: state.gearOpen}); } });
// ---- Gear spoker: the 474 kB gear asset loads only once this section is near the viewport.
const gearForm = $('gear-form'), gearFields = ['count', 'pad', 'root', 'tip', 'outer', 'fillet'];
let gearPlain = false, gearTimer, gearDiagramNarrow;
function gearInput() { return {plain: gearPlain, ...Object.fromEntries(gearFields.map(k => [k, Number($('g-' + k).value)]))}; }
function setGearInputs(g) { gearPlain = g.plain; for (const k of gearFields) $('g-' + k).value = g[k]; }
function markPreset() {
  const g = gearInput(), match = g.plain ? 'plain' : Object.entries(gearPresets).find(([, v]) => gearFields.every(k => v[k] === g[k]))?.[0];
  for (const b of gearForm.querySelectorAll('[data-preset]')) b.setAttribute('aria-pressed', String(b.dataset.preset === match));
  for (const k of gearFields) $('g-' + k).disabled = g.plain;
}
function drawGear(error = '') {
  gearDiagramNarrow = $('gear-diagram').clientWidth < 640;
  $('gear-diagram').innerHTML = gearDiagram(gearInput(), {narrow: gearDiagramNarrow, error});
}
new ResizeObserver(() => { if (($('gear-diagram').clientWidth < 640) !== gearDiagramNarrow) drawGear($('gear-error').hidden ? '' : 'x'); }).observe($('gear-diagram'));
function gearFacts(p, r) {
  const rows = r ? [['Gear · solid PETG', `${r.grams.toFixed(1)} g`], ['Saved vs plain web · solid', `${r.gramsSaved.toFixed(1)} g`]] : [];
  if (!p.plain) rows.push(['Hub-side opening', `${p.hubGap.toFixed(2)} mm`], ['Narrowest spoke', `${mm(p.narrowest)} mm`], ['Rim inside teeth', `${mm(Math.round(p.rim * 100) / 100)} mm`]);
  facts($('gear-facts'), rows);
}
function gearChanged({immediate = false, build = true} = {}) {
  clearTimeout(gearTimer); state.gearJob?.terminate(); state.gear = null; $('dl-gear-stl').disabled = true; markPreset();
  let p;
  try { p = gearParameters(gearInput()); } catch (e) {
    drawGear(e.message);
    gearTimer = setTimeout(() => { $('gear-error').hidden = false; $('gear-error').textContent = e.message; $('gear-status').textContent = 'Adjust the highlighted value to generate.'; }, immediate ? 0 : 700);
    return;
  }
  $('gear-error').hidden = true; drawGear(); gearFacts(p);
  if (!build) return;
  $('gear-status').textContent = 'Generating gear…';
  gearTimer = setTimeout(() => generateGear(p), immediate ? 0 : 400);
}
function generateGear(p) {
  state.gearStarted = true; state.gearJob?.terminate();
  viewNote(gearView, $('gear-note'), state.gearShown ? 'Previous gear shown · cutting the new windows…' : 'Loading the gear and cutting windows in your browser…');
  const progress = document.getElementById('task-progress'); if (progress) $('gear-status').after(progress);
  const job = state.gearJob = taskWorker(WORKER, $('gear-status'));
  job.onmessage = ({data}) => {
    job.terminate(); if (state.gearJob !== job) return;
    if (data.error) { $('gear-status').textContent = 'Generation failed: ' + data.error; viewNote(gearView, $('gear-note'), 'Generation failed · see the message beside the settings.'); return; }
    const r = state.gear = data.result; $('dl-gear-stl').disabled = false;
    $('gear-status').textContent = `${r.parameters.plain ? 'Plain' : r.parameters.count + '-spoke'} gear ready · one closed solid, teeth and hub unchanged`;
    gearFacts(r.parameters, r);
    gearView?.show([{...r.part, color: 0x5da3ad, offset: 0}], !state.gearShown); state.gearShown = true;
  };
  job.onerror = () => { job.terminate(); $('gear-status').textContent = 'The geometry engine could not start. Reload the page; this needs a browser with WebAssembly and module workers.'; };
  job.postMessage({kind: 'gear', parameters: p.plain ? {plain: true} : Object.fromEntries(['plain', ...gearFields].map(k => [k, p[k]]))});
}
gearForm.addEventListener('input', () => gearChanged({build: state.gearOpen}));
gearForm.addEventListener('change', e => { if (e.target.type === 'number') gearChanged({immediate: true, build: state.gearOpen}); });
gearForm.addEventListener('submit', e => { e.preventDefault(); gearChanged({immediate: true}); });
for (const b of gearForm.querySelectorAll('[data-preset]')) b.onclick = () => {
  if (b.dataset.preset === 'plain') gearPlain = true; else setGearInputs({plain: false, ...gearPresets[b.dataset.preset]});
  gearChanged({immediate: true, build: state.gearOpen});
};
$('dl-gear-stl').onclick = () => { if (state.gear) download(state.gear.part.stl, 'model/stl', state.gear.part.stem + '.stl'); };
new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting) && !state.gearOpen) { state.gearOpen = true; gearChanged({immediate: true}); } }, {rootMargin: '200px'}).observe($('gear'));

restore();
nutFacts(nutParameters(nutInput()));
gearChanged({build: false});
ringChanged({immediate: true});
