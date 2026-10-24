/**
 * Kraken spool centering rings and spool nut, remixed from humebeam's Kraken
 * (https://www.printables.com/model/1788417-kraken-revolutionary-bambu-lab-ams, CC BY-NC 4.0).
 *
 * Coordinates: millimetres, ring axis on Z, base face at Z0, first pentagon corner on +Y.
 * The ring construction repeats generate_family.build_pair in thereprocase/kraken-remix-ogAMS
 * operation for operation; the nut repeats gear-taper-2026-10-24/nut/build_nut.py with the
 * added thickness as a parameter. scripts/check-kraken-rings.mjs compares both with the Python output.
 */
export const RING = Object.freeze({
  lead_radial_reduction: 1.9, lead_height: 2.0, lip_thickness: 0.4,
  gear_flange_thickness: 1.5, flange_radial_reach: 10.25,
  maximum_preserved_radius: 22.5, preserved_region_overlap: 0.1, minimum_preserved_radius: 20.3,
  circular_segments: 256, corners: 5, phase_degrees: 90,
});
export const NUT = Object.freeze({
  pitch: 6.0, split_radius: 16.5, chamfer_r0: 15.40, chamfer_slope: 0.578, chamfer_depth: 1.05,
  fill_top: 1.0, original_flange: 1.5, maximum_added: 6.0, segments: 720, petg_density: 1.26,
});
export const ringDefaults = Object.freeze({hole: 53.4, bite: 0.7, clearance: 0.1});
export const nutDefaults = Object.freeze({flange: 3.5});
export const ringLimits = Object.freeze({hole: [45, 95], bite: [0, 1.5], clearance: [0, 0.5]});
export const nutLimits = Object.freeze({flange: [NUT.original_flange, NUT.original_flange + NUT.maximum_added]});
export const CREDIT = 'remix of Kraken by humebeam, CC BY-NC 4.0';

const onStep = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6;
/** Shortest decimal for a 0.01 mm grid value: 53.4 -> "53.4", 55 -> "55". */
export const mm = x => String(Number(Number(x).toFixed(2)));

export function ringParameters(input = {}) {
  for (const k of Object.keys(input)) if (!(k in ringDefaults)) throw Error(`Unknown ring setting: ${k}`);
  const p = {...ringDefaults, ...input};
  const [hlo, hhi] = ringLimits.hole;
  if (!Number.isFinite(p.hole) || p.hole < hlo - 1e-9 || p.hole > hhi + 1e-9 || !onStep(p.hole, 0.1))
    throw Error(`Spool hole: enter ${hlo}.0 to ${hhi}.0 mm in 0.1 mm steps.`);
  for (const [k, label] of [['bite', 'Bite'], ['clearance', 'Undersize']]) {
    const [lo, hi] = ringLimits[k];
    if (!Number.isFinite(p[k]) || p[k] < lo - 1e-9 || p[k] > hi + 1e-9 || !onStep(p[k], 0.01))
      throw Error(`${label}: enter ${lo} to ${hi} mm radial in 0.01 mm steps.`);
  }
  p.hole = Math.round(p.hole * 10) / 10; p.bite = Math.round(p.bite * 100) / 100; p.clearance = Math.round(p.clearance * 100) / 100;
  const radius = p.hole / 2, support = radius - p.clearance, corner = radius + p.bite;
  const scale = (corner - RING.lead_radial_reduction) / corner;
  // At the smallest sizes the lead-in must clear the preserved holder core.
  const preserve = Math.min(RING.maximum_preserved_radius, support * scale - RING.preserved_region_overlap);
  if (!(preserve > RING.minimum_preserved_radius))
    throw Error(`At ${mm(p.hole)} mm the lead-in would cut into humebeam's holder core (needs ${RING.minimum_preserved_radius} mm radius, has ${preserve.toFixed(2)}). Reduce the undersize or the bite.`);
  // A fractional size uses the holder interface of the next smaller stock ring (generate_family.main).
  const stock = Math.floor(p.hole + 1e-9);
  return {...p, radius, support, corner, scale, preserve, stock,
    lipDiameter: stock + 5, flangeOD: p.hole + 2 * RING.flange_radial_reach,
    topCornerDiameter: 2 * corner * scale, topSupportDiameter: 2 * support * scale};
}

export function nutParameters(input = {}) {
  for (const k of Object.keys(input)) if (!(k in nutDefaults)) throw Error(`Unknown nut setting: ${k}`);
  const p = {...nutDefaults, ...input}, [lo, hi] = nutLimits.flange;
  if (!Number.isFinite(p.flange) || p.flange < lo - 1e-9 || p.flange > hi + 1e-9 || !onStep(p.flange, 0.1))
    throw Error(`Flange thickness: enter ${lo} to ${hi} mm in 0.1 mm steps. Beyond +${NUT.maximum_added} mm the one-pitch thread copy would run out of source thread.`);
  p.flange = Math.round(p.flange * 10) / 10;
  return {...p, added: Math.round((p.flange - NUT.original_flange) * 10) / 10};
}

export const ringSides = ['gear-side-1.5mm-flange', 'cap-side'];
export function ringStem(p, side) {
  const tuned = p.bite !== ringDefaults.bite || p.clearance !== ringDefaults.clearance ? `-bite${mm(p.bite)}-under${mm(p.clearance)}` : '';
  return `kraken-spool-ring-${mm(p.hole)}-mm-pentagon-${side}${tuned}`;
}
export const nutStem = p => `kraken-spool-nut-${mm(p.flange)}mm-flange`;

/** KRM1 asset: "KRM1", uint32 vertex count, triangle count, index width; float32 xyz; indices. */
export function readKRM(buffer) {
  const head = new DataView(buffer, 0, 16);
  if (new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) !== 'KRM1') throw Error('Geometry asset is not a KRM1 mesh.');
  const nv = head.getUint32(4, true), nt = head.getUint32(8, true), width = head.getUint32(12, true);
  if (16 + nv * 12 + nt * 3 * width !== buffer.byteLength) throw Error('Geometry asset is truncated.');
  const vertices = new Float32Array(buffer.slice(16, 16 + nv * 12));
  const raw = buffer.slice(16 + nv * 12);
  return {vertices, triangles: Uint32Array.from(width === 2 ? new Uint16Array(raw) : new Uint32Array(raw))};
}

function scope(module) {
  const owned = [];
  const keep = o => { owned.push(o); return o; };
  const release = () => { for (const o of owned.reverse()) try { o.delete(); } catch {} };
  const {Manifold, CrossSection, Mesh} = module;
  const solid = ({vertices, triangles}) => {
    const mesh = new Mesh({numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(triangles)});
    mesh.merge();
    const m = keep(new Manifold(mesh));
    if (m.status() !== 'NoError') throw Error('Source mesh is not a closed solid: ' + m.status());
    return m;
  };
  return {keep, release, Manifold, CrossSection, Mesh, solid};
}

// Re-enter the kernel at float32 STL coordinates, as the gridfinity generators do, so the
// downloaded file is the solid that was checked.
function exportSolid(s, shape, label) {
  const out = shape.getMesh(), n = out.numProp, v = out.vertProperties;
  const vertices = new Float32Array(v.length / n * 3);
  for (let i = 0; i < v.length / n; i++) for (let k = 0; k < 3; k++) vertices[3 * i + k] = v[n * i + k];
  const triangles = new Uint32Array(out.triVerts);
  const final = s.solid({vertices, triangles}), parts = final.decompose();
  parts.forEach(s.keep);
  if (parts.length !== 1 || Math.abs(final.volume() - shape.volume()) / shape.volume() > 1e-5)
    throw Error(`${label}: the float32 export changed the solid. Please report these settings.`);
  const b = final.boundingBox();
  return {vertices, triangles, volume: final.volume(), bounds: [...b.min, ...b.max]};
}

/** Cap-side and gear-side rings from one stock ring's core+lip asset (see scripts/build-kraken-ring-assets.py). */
export function buildRings(module, core, input) {
  const p = ringParameters(input), s = scope(module), {Manifold, CrossSection, keep} = s, R = RING, n = R.circular_segments;
  try {
    const stock = s.solid(core), height = stock.boundingBox().max[2];
    if (Math.abs(height - 10.4) > 1e-3) throw Error('Unexpected holder core height.');
    const angles = Array.from({length: R.corners}, (_, i) => (R.phase_degrees + 360 / R.corners * i) * Math.PI / 180);
    const polygon = keep(CrossSection.ofPolygons([angles.map(a => [p.corner * Math.cos(a), p.corner * Math.sin(a)])]));
    const outline = keep(polygon.add(keep(CrossSection.circle(p.support, n))));
    const lipT = R.lip_thickness, leadH = R.lead_height, r = p.radius;
    const straight = keep(keep(outline.extrude(height - leadH - lipT)).translate([0, 0, lipT]));
    const lead = keep(keep(outline.extrude(leadH, 0, 0, [p.scale, p.scale])).translate([0, 0, height - leadH]));
    const keepCyl = keep(keep(Manifold.cylinder(height + 2, p.preserve, p.preserve, n)).translate([0, 0, -1]));
    const lipMask = keep(keep(Manifold.cube([2 * (r + 5), 2 * (r + 5), lipT])).translate([-r - 5, -r - 5, 0]));
    const cap = keep(keep(keep(stock.intersect(keepCyl)).add(keep(keep(straight.add(lead)).subtract(keepCyl)))).add(keep(stock.intersect(lipMask))));
    const flangeT = R.gear_flange_thickness, rise = flangeT - lipT;
    const raised = keep(cap.translate([0, 0, rise]));
    const above = keep(keep(Manifold.cube([2 * (r + 15), 2 * (r + 15), height + 2])).translate([-r - 15, -r - 15, flangeT]));
    const outer = keep(CrossSection.circle(r + R.flange_radial_reach, n)), inner = keep(CrossSection.circle(r - 0.01, n));
    const flange = keep(keep(keep(cap.slice(lipT / 2)).add(keep(outer.subtract(inner)))).extrude(flangeT));
    const gear = keep(keep(raised.intersect(above)).add(flange));
    // Independent section check from build_pair: five corners at the requested radius.
    const section = keep(cap.slice(height - leadH - 0.1)).toPolygons().flat();
    const reach = Math.max(...section.map(([x, y]) => Math.hypot(x, y)));
    if (Math.abs(reach - p.corner) > 1e-5) throw Error('Pentagon corner radius check failed.');
    const parts = {};
    for (const [side, body] of [['gear-side-1.5mm-flange', gear], ['cap-side', cap]]) {
      const pieces = body.decompose(); pieces.forEach(keep);
      if (body.status() !== 'NoError' || pieces.length !== 1 || !(body.volume() > 0)) throw Error(`The ${side} ring is not one closed solid.`);
      parts[side] = {...exportSolid(s, body, side), stem: ringStem(p, side)};
    }
    return {parameters: p, height, parts};
  } finally { s.release(); }
}

/** Thicken the nut flange on its outer face by `added` mm; the outer face lands on Z0. */
export function buildNut(module, source, input) {
  const p = nutParameters(input), s = scope(module), {Manifold, CrossSection, keep} = s, N = NUT, a = p.added;
  try {
    const nut = s.solid(source), originalVolume = nut.volume();
    let out = nut;
    if (a > 0) {
      const cyl = (r, z0, z1) => keep(keep(Manifold.cylinder(z1 - z0, r, r, N.segments)).translate([0, 0, z0]));
      const slab = (z0, z1) => keep(keep(Manifold.cube([200, 200, z1 - z0])).translate([-100, -100, z0]));
      const bore = cyl(N.split_radius, Math.min(-5, -a - 1), 5);
      // Lower slab: the original Z0..1.0 flange edge (with its bed chamfer) moved down by `added`.
      const lower = keep(keep(keep(nut.translate([0, 0, -a])).intersect(slab(-a, N.fill_top - a))).subtract(bore));
      const outline = keep(CrossSection.ofPolygons(keep(nut.slice(N.fill_top)).toPolygons(), 'EvenOdd'));
      const middle = keep(keep(keep(outline.extrude(a)).translate([0, 0, N.fill_top - a])).subtract(bore));
      // Single-start 6 mm trapezoid: the bore one pitch lower stays in phase.
      const inner = keep(keep(nut.translate([0, 0, -N.pitch])).intersect(cyl(N.split_radius, -a, N.fill_top)));
      const cone = keep(keep(Manifold.cylinder(N.chamfer_depth, N.chamfer_r0, N.chamfer_r0 - N.chamfer_slope * N.chamfer_depth, N.segments)).translate([0, 0, -a]));
      const added = keep(keep(keep(lower.add(middle)).add(inner)).subtract(cone));
      out = keep(keep(nut.add(added)).translate([0, 0, a]));
      const pieces = out.decompose(); pieces.forEach(keep);
      if (out.status() !== 'NoError' || pieces.length !== 1) throw Error('The thickened nut is not one closed solid.');
    }
    const part = exportSolid(s, out, 'nut');
    return {parameters: p, part: {...part, stem: nutStem(p)}, originalVolume,
      addedVolume: part.volume - originalVolume, addedGrams: (part.volume - originalVolume) * N.petg_density / 1000};
  } finally { s.release(); }
}

/** Binary STL with facet normals; the 80-byte header carries the credit. */
export function binarySTL({vertices: v, triangles: t}, header) {
  const b = new ArrayBuffer(84 + t.length / 3 * 50), d = new DataView(b), text = new TextEncoder().encode(header).slice(0, 80);
  new Uint8Array(b).set(text); d.setUint32(80, t.length / 3, true);
  for (let i = 0; i < t.length; i += 3) {
    const o = 84 + i / 3 * 50, a = t[i] * 3, bb = t[i + 1] * 3, c = t[i + 2] * 3;
    const ux = v[bb] - v[a], uy = v[bb + 1] - v[a + 1], uz = v[bb + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
    d.setFloat32(o, nx / l, true); d.setFloat32(o + 4, ny / l, true); d.setFloat32(o + 8, nz / l, true);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) d.setFloat32(o + 12 + j * 12 + k * 4, v[t[i + j] * 3 + k], true);
  }
  return b;
}
export const ringHeader = (p, side) => `Kraken spool ring ${mm(p.hole)} mm ${side.startsWith('gear') ? 'gear side' : 'cap side'}; ${CREDIT}`;
export const nutHeader = p => `Kraken spool nut ${mm(p.flange)} mm flange; ${CREDIT}`;
