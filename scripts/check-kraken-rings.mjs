// Kraken ring and nut kernel checks under node, against the Python generators' output.
// Usage: node scripts/check-kraken-rings.mjs [--rings DIR] [--sizes 55,53.4,45] [--nut NUT_STL --nut-flange 3] [--gears DIR]
//   --rings: a generate_family.py output (models/*.3mf and *.stl) or a published models directory.
//   --nut:   build_nut.py output (outer face at Z = -(flange - 1.5)).
//   --gears: directory with gear-spokes.stl, gear-taper-r54t12.stl, gear-n6r42t12.stl (gear_web*.py output).
// Without reference paths it checks the kernel's own invariants, limits and file names.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {inflateRawSync, gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Module from '../public/gridfinity-shelves/vendor/manifold.js';
import {ringDiagram, gearDiagram} from '../public/kraken-rings/diagram.js';
import {buildRings, buildNut, buildGear, readKRM, ringParameters, nutParameters, gearParameters, gearPresets, ringStem, binarySTL, ringHeader, nutHeader, gearHeader, RING} from '../public/kraken-rings/kernel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public/kraken-rings/assets');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const m = await Module(); m.setup();
const {Manifold, Mesh} = m;
const load = async name => { const b = await readFile(path.join(assets, name)); return readKRM(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const solid = (vertices, triangles) => { const mesh = new Mesh({numProp: 3, vertProperties: Float32Array.from(vertices), triVerts: Uint32Array.from(triangles)}); mesh.merge(); return new Manifold(mesh); };
const symmetric = (a, b) => { const x = a.subtract(b), y = b.subtract(a), v = Math.abs(x.volume()) + Math.abs(y.volume()); x.delete(); y.delete(); return v; };

function indexed(points) { // exact duplicate merge, as numpy.unique in the Python readers
  const ids = new Map(), vertices = [], triangles = new Uint32Array(points.length / 3);
  for (let i = 0; i < points.length / 3; i++) {
    const key = `${points[3 * i]},${points[3 * i + 1]},${points[3 * i + 2]}`;
    let id = ids.get(key); if (id === undefined) { id = vertices.length / 3; ids.set(key, id); vertices.push(points[3 * i], points[3 * i + 1], points[3 * i + 2]); }
    triangles[i] = id;
  }
  return {vertices, triangles};
}
async function readSTL(file, dz = 0) {
  const b = await readFile(file), d = new DataView(b.buffer, b.byteOffset, b.byteLength), n = d.getUint32(80, true), pts = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) for (let j = 0; j < 9; j++) pts[9 * i + j] = d.getFloat32(84 + 50 * i + 12 + 4 * j, true) + (j % 3 === 2 ? dz : 0);
  const {vertices, triangles} = indexed(pts); return solid(vertices, triangles);
}
async function read3MF(file) { // stored or deflated entries; 3D/3dmodel.model only
  const b = await readFile(file);
  for (let o = 0; o < b.length - 30;) {
    if (b.readUInt32LE(o) !== 0x04034b50) break;
    const method = b.readUInt16LE(o + 8), size = b.readUInt32LE(o + 18), nl = b.readUInt16LE(o + 26), el = b.readUInt16LE(o + 28);
    const name = b.toString('utf8', o + 30, o + 30 + nl), start = o + 30 + nl + el, raw = b.subarray(start, start + size);
    if (name.endsWith('.model')) {
      const xml = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
      const v = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].flatMap(x => [+x[1], +x[2], +x[3]]);
      const t = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].flatMap(x => [+x[1], +x[2], +x[3]]);
      // Manifold's JS mesh is float32, so the 3MF reference is compared at float32 resolution.
      const mesh = new Mesh({numProp: 3, vertProperties: Float32Array.from(v), triVerts: Uint32Array.from(t)}); mesh.merge();
      return new Manifold(mesh);
    }
    o = start + size;
  }
  throw Error('No 3D model in ' + file);
}

// Limits, names and parameter derivations.
assert.throws(() => ringParameters({hole: 44.9})); assert.throws(() => ringParameters({hole: 95.1})); assert.throws(() => ringParameters({hole: 53.45}));
assert.equal(ringParameters({hole: 95}).hole, 95); assert.equal(ringParameters({hole: 45}).stock, 45); assert.equal(ringParameters({hole: 53.4}).stock, 53);
assert.throws(() => ringParameters({hole: 45, bite: 0, clearance: 0.5}), /holder core/);
assert.equal(ringStem(ringParameters({hole: 53.4}), 'gear-side-1.5mm-flange'), 'kraken-spool-ring-53.4-mm-pentagon-gear-side-1.5mm-flange');
assert.equal(ringStem(ringParameters({hole: 55}), 'cap-side'), 'kraken-spool-ring-55-mm-pentagon-cap-side');
assert.equal(ringStem(ringParameters({hole: 55, bite: 0.8}), 'cap-side'), 'kraken-spool-ring-55-mm-pentagon-cap-side-bite0.8-under0.1');
assert.throws(() => nutParameters({flange: 1.4})); assert.throws(() => nutParameters({flange: 7.6})); assert.equal(nutParameters({flange: 7.5}).added, 6);
assert.equal(nutParameters({}).flange, 3.5);
const header = new TextDecoder().decode(new Uint8Array(binarySTL({vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2]}, ringHeader(ringParameters({hole: 95}), 'gear-side-1.5mm-flange')), 0, 80));
assert.match(header, /Repro remix of Kraken by humebeam, CC BY-NC 4\.0/); assert.ok(!header.startsWith('solid'));
for (const h of [ringHeader(ringParameters({hole: 95, bite: 1.25}), 'gear-side-1.5mm-flange'), nutHeader(nutParameters({flange: 7.5})), gearHeader(gearParameters({count: 12, root: 10, tip: 10})), gearHeader(gearParameters({plain: true}))])
  assert.ok(new TextEncoder().encode(h).length <= 80 && h.endsWith('Repro remix of Kraken by humebeam, CC BY-NC 4.0'), 'STL header too long: ' + h);
console.log('Limits, stock-interface selection, file names and STL credit header: PASS');
for (const input of [{hole: 45}, {hole: 53.4}, {hole: 95}, {hole: 60, bite: 0, clearance: 0}, {hole: 70, bite: 1.5, clearance: 0.5}]) for (const narrow of [false, true]) {
  const p = ringParameters(input), svg = ringDiagram(p, {narrow});
  assert.ok(!/NaN|undefined|Infinity/.test(svg), `diagram ${input.hole} narrow=${narrow}`);
  for (const value of [p.hole, p.flangeOD, 2 * p.corner, 2 * p.support]) assert.ok(svg.includes(`Ø${Number(value.toFixed(2))}`), `diagram label ${value}`);
}
for (const input of [gearPresets.spokes, gearPresets.r54t12, gearPresets.n6r42t12, {...gearPresets.spokes, plain: true}, {...gearPresets.spokes, count: 12}]) for (const narrow of [false, true])
  assert.ok(!/NaN|undefined|Infinity/.test(gearDiagram(input, {narrow})), 'gear diagram');
console.log('Fit diagrams (rings and gear), wide and narrow: PASS');

const sizes = (opt('--sizes') ?? '55,53.4,45').split(',').map(Number), refs = opt('--rings'), rows = [];
for (const hole of sizes) {
  const p = ringParameters({hole}), t0 = performance.now();
  const r = buildRings(m, await load(`core-${p.stock}.bin`), {hole});
  const ms = performance.now() - t0;
  for (const [side, part] of Object.entries(r.parts)) {
    const top = 10.4; // every stock core is 10.4 mm tall
    assert.ok(Math.abs(part.bounds[2]) < 1e-5 && Math.abs(part.bounds[5] - (top + (side.startsWith('gear') ? RING.gear_flange_thickness - RING.lip_thickness : 0))) < 1e-3, 'bounds ' + side);
    const row = {hole, side, js_volume_mm3: +part.volume.toFixed(4), build_ms: Math.round(ms)};
    if (refs) {
      const stem = path.join(refs, part.stem), ours = solid(part.vertices, part.triangles);
      for (const ext of ['3mf', 'stl']) {
        if (!existsSync(`${stem}.${ext}`)) continue;
        const ref = ext === '3mf' ? await read3MF(`${stem}.${ext}`) : await readSTL(`${stem}.${ext}`);
        row[`py_${ext}_volume_mm3`] = +ref.volume().toFixed(4);
        row[`symdiff_vs_py_${ext}_mm3`] = +symmetric(ours, ref).toExponential(3);
        ref.delete();
      }
      ours.delete();
      assert.ok((row.symdiff_vs_py_3mf_mm3 ?? row.symdiff_vs_py_stl_mm3) < 0.05, `${part.stem}: symmetric difference above 0.05 mm3`);
    }
    rows.push(row);
  }
}
console.table(rows);

const nutRef = opt('--nut'), t1 = performance.now(), nutSource = await load('nut.bin');
for (const flange of [1.5, 3.5, 7.5]) {
  const n = buildNut(m, nutSource, {flange});
  assert.ok(Math.abs(n.part.bounds[2]) < 1e-5);
  console.log(`nut ${flange} mm: volume ${n.part.volume.toFixed(2)} mm3, added ${n.addedGrams.toFixed(2)} g PETG, height ${(n.part.bounds[5] - n.part.bounds[2]).toFixed(3)} mm`);
}
if (nutRef) {
  const flange = Number(opt('--nut-flange') ?? 3), n = buildNut(m, nutSource, {flange}), ours = solid(n.part.vertices, n.part.triangles);
  const ref = await readSTL(nutRef, flange - 1.5), d = symmetric(ours, ref);
  console.log(`nut ${flange} mm vs ${path.basename(nutRef)}: JS ${ours.volume().toFixed(4)} mm3, Python ${ref.volume().toFixed(4)} mm3, symmetric difference ${d.toExponential(3)} mm3, ${Math.round(performance.now() - t1)} ms total`);
  assert.ok(d < 0.05, 'nut symmetric difference above 0.05 mm3');
}

// Gear: guards, exact retention of facets outside the cut zone, and the Python presets.
assert.throws(() => gearParameters({count: 12, root: 26}), /close off at the hub/);
assert.throws(() => gearParameters({tip: 1}), /enter 1.35/);
assert.throws(() => gearParameters({pad: 80, outer: 88}), /must stay inside the window/);
assert.throws(() => gearParameters({outer: 91}), /enter 40 to 90/);
assert.throws(() => gearParameters({fillet: 8, count: 12, root: 10, tip: 10}), /fillet|close off/);
assert.equal(gearParameters({plain: true}).windows, 0);
const gb = gunzipSync(await readFile(path.join(assets, 'gear-plain.bin.gz'))), plain = readKRM(gb.buffer.slice(gb.byteOffset, gb.byteOffset + gb.byteLength));
const facetKeys = ({vertices: v, triangles: t}, keepTri) => {
  const keys = new Set();
  for (let i = 0; i < t.length; i += 3) {
    const pts = [0, 1, 2].map(j => [v[3 * t[i + j]], v[3 * t[i + j] + 1], v[3 * t[i + j] + 2]]);
    if (keepTri(pts)) keys.add(pts.map(q => q.join(',')).sort().join('|'));
  }
  return keys;
};
const untouched = pts => pts.some(q => q[2] > 4 + 1e-6) || Math.min(...pts.map(q => Math.hypot(q[0], q[1]))) > 90.01;
const before = facetKeys(plain, untouched), gearRows = [], gearRefs = opt('--gears');
for (const [name, preset] of [['spokes', gearPresets.spokes], ['taper-r54t12', gearPresets.r54t12], ['n6r42t12', gearPresets.n6r42t12], ['plain', {plain: true}]]) {
  const t0 = performance.now(), g = buildGear(m, plain, preset), ms = Math.round(performance.now() - t0);
  const after = facetKeys(g.part, untouched); let missing = 0; for (const k of before) if (!after.has(k)) missing++;
  assert.equal(missing, 0, name + ': retained facets changed');
  // Analytic window areas from gear_web_taper.geometry_report (OCCT face.area of the filleted window).
  const area = {spokes: 1135.6231758100107, 'taper-r54t12': 1085.6884108826948, n6r42t12: 2017.3165616093586, plain: 0}[name];
  const analytic = g.plainVolume - (preset.count ?? 0) * area * 4;
  assert.ok(Math.abs(g.part.volume - analytic) < 0.3, name + ': volume differs from the analytic design by 0.3 mm3 or more');
  const row = {preset: name, js_volume_mm3: +g.part.volume.toFixed(3), js_minus_analytic_mm3: +(g.part.volume - analytic).toFixed(4), solid_g: +g.grams.toFixed(2), retained_facets: `${before.size}/${before.size}`, build_ms: ms};
  const ref = gearRefs && path.join(gearRefs, `gear-${name}.stl`);
  if (ref && existsSync(ref)) {
    const theirs = await readSTL(ref), ours = solid(g.part.vertices, g.part.triangles);
    row.py_minus_analytic_mm3 = +(theirs.volume() - analytic).toFixed(4); row.volume_diff_mm3 = +(ours.volume() - theirs.volume()).toFixed(4); row.symdiff_mm3 = +symmetric(ours, theirs).toFixed(4);
    theirs.delete(); ours.delete();
    // The Python meshes tessellate window arcs with OCCT at 0.005 mm deflection; the
    // remaining difference is that chord sag, so require < 2 mm3 here and judge accuracy
    // against the analytic volume below.
    assert.ok(row.symdiff_mm3 < 2, name + ': symmetric difference above 2 mm3');
  }
  gearRows.push(row);
}
console.table(gearRows);
console.log('Kraken ring, nut and gear kernel checks: PASS');
