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
  lead_radial_reduction: 1.9, lead_height: 2.0, lip_thickness: 0.4, flange_radial_reach: 10.25,
  maximum_preserved_radius: 22.5, preserved_region_overlap: 0.1, minimum_preserved_radius: 20.3,
  circular_segments: 256, corners: 5, phase_degrees: 90,
});
// Flange sets in mm (generate_family.FLANGE_SETS). humebeam's 0.4 mm source lip is too thin to
// survive bed removal and handling on the cap side, so "normal" thickens both sides.
export const FLANGE_SETS = Object.freeze({normal: Object.freeze({cap: 0.6, gear: 2.2}), skinny: Object.freeze({cap: 0.4, gear: 0.4})});
// Hard plastic hubs (generate_family.SPRING): round spigot at a friction clearance, four spring fingers.
export const SPRING = Object.freeze({clearance: 0.2, fingers: 4, finger_degrees: 30, slot: 1.0, finger_thickness: 1.3,
  bow: 0.2, root_above_base: 1.6, root_overlap: 0.3, peak_fraction: 0.75, minimum_core_wall: 0.8});
export const CORES = Object.freeze(['pentagon', 'spring']);
export const sideNames = set => ({gear: `gear-side-${mm(FLANGE_SETS[set].gear)}mm-flange`, cap: `cap-side-${mm(FLANGE_SETS[set].cap)}mm-lip`});
export const NUT = Object.freeze({
  pitch: 6.0, split_radius: 16.5, chamfer_r0: 15.40, chamfer_slope: 0.578, chamfer_depth: 1.05,
  fill_top: 1.0, original_flange: 1.5, maximum_added: 6.0, segments: 720, petg_density: 1.26,
});
export const ringDefaults = Object.freeze({hole: 53.4, bite: 0.7, clearance: 0.1, set: 'normal', core: 'pentagon'});
export const nutDefaults = Object.freeze({flange: 3.5});
export const ringLimits = Object.freeze({hole: [45, 95], bite: [0, 1.5], clearance: [0, 0.5]});
export const nutLimits = Object.freeze({flange: [NUT.original_flange, NUT.original_flange + NUT.maximum_added]});
export const CREDIT = 'Repro remix of Kraken by humebeam, CC BY-NC 4.0';

const onStep = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6;
/** Shortest decimal for a 0.01 mm grid value: 53.4 -> "53.4", 55 -> "55". */
export const mm = x => String(Number(Number(x).toFixed(2)));

export function ringParameters(input = {}) {
  for (const k of Object.keys(input)) if (!(k in ringDefaults)) throw Error(`Unknown ring setting: ${k}`);
  const p = {...ringDefaults, ...input};
  if (!Object.hasOwn(FLANGE_SETS, p.set)) throw Error(`Flange set: choose ${Object.keys(FLANGE_SETS).join(' or ')}.`);
  if (!CORES.includes(p.core)) throw Error(`Spool core: choose ${CORES.join(' or ')}.`);
  const [hlo, hhi] = ringLimits.hole;
  if (!Number.isFinite(p.hole) || p.hole < hlo - 1e-9 || p.hole > hhi + 1e-9 || !onStep(p.hole, 0.1))
    throw Error(`Spool hole: enter ${hlo}.0 to ${hhi}.0 mm in 0.1 mm steps.`);
  for (const [k, label] of [['bite', 'Bite'], ['clearance', 'Undersize']]) {
    const [lo, hi] = ringLimits[k];
    if (!Number.isFinite(p[k]) || p[k] < lo - 1e-9 || p[k] > hi + 1e-9 || !onStep(p[k], 0.01))
      throw Error(`${label}: enter ${lo} to ${hi} mm radial in 0.01 mm steps.`);
  }
  p.hole = Math.round(p.hole * 10) / 10; p.bite = Math.round(p.bite * 100) / 100; p.clearance = Math.round(p.clearance * 100) / 100;
  const radius = p.hole / 2, spring = p.core === 'spring';
  // A spring ring sits at the fixed friction clearance; its fingers do the gripping, so bite and undersize do not apply.
  const support = radius - (spring ? SPRING.clearance : p.clearance), corner = spring ? support : radius + p.bite;
  const scale = (corner - RING.lead_radial_reduction) / corner;
  // At the smallest sizes the lead-in must clear the preserved holder core.
  const preserve = Math.min(RING.maximum_preserved_radius, support * scale - RING.preserved_region_overlap);
  if (!(preserve > RING.minimum_preserved_radius))
    throw Error(`At ${mm(p.hole)} mm the lead-in would cut into humebeam's holder core (needs ${RING.minimum_preserved_radius} mm radius, has ${preserve.toFixed(2)}). Reduce the undersize or the bite.`);
  const fingerInner = support - SPRING.finger_thickness, coreWall = fingerInner - SPRING.slot - preserve;
  if (spring && coreWall < SPRING.minimum_core_wall - 1e-9)
    throw Error(`Spring rings need a hole of at least ${mm(2 * (RING.maximum_preserved_radius + SPRING.minimum_core_wall + SPRING.slot + SPRING.finger_thickness + SPRING.clearance))} mm: below that the finger slots would cut into humebeam's holder core.`);
  // A fractional size uses the holder interface of the next smaller stock ring (generate_family.main).
  const stock = Math.floor(p.hole + 1e-9), {cap: capT, gear: gearT} = FLANGE_SETS[p.set], sides = sideNames(p.set);
  return {...p, radius, support, corner, scale, preserve, stock, capT, gearT, sides,
    fingerInner, coreWall, peakDiameter: 2 * (radius + SPRING.bow),
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

export function ringStem(p, side) {
  const tuned = p.core === 'pentagon' && (p.bite !== ringDefaults.bite || p.clearance !== ringDefaults.clearance) ? `-bite${mm(p.bite)}-under${mm(p.clearance)}` : '';
  return `kraken-spool-ring-${mm(p.hole)}-mm-${p.core}-${side}${tuned}`;
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

/**
 * Grow the Z0 lip of `cap` to `baseT` and optionally widen it to `reach` (generate_family.thicken).
 * Everything above the lip moves up; the new base keeps the source-lip section (bore, snap ribs)
 * as a constant prism.
 */
function thicken(s, cap, baseT, preserve, reach) {
  const {Manifold, CrossSection, keep} = s, R = RING, n = R.circular_segments, lipT = R.lip_thickness, rise = baseT - lipT;
  if (Math.abs(rise) < 1e-9 && reach === undefined) return cap;
  const b = cap.boundingBox(), half = Math.max(...[b.min[0], b.min[1], b.max[0], b.max[1]].map(Math.abs)) + 30;
  const above = keep(keep(Manifold.cube([2 * half, 2 * half, b.max[2] + rise + 2])).translate([-half, -half, baseT]));
  let section = keep(cap.slice(lipT / 2));
  if (reach !== undefined) section = keep(section.add(keep(keep(CrossSection.circle(reach, n)).subtract(keep(CrossSection.circle(reach - R.flange_radial_reach - 0.01, n))))));
  return keep(keep(keep(cap.translate([0, 0, rise])).intersect(above)).add(keep(section.extrude(baseT))));
}

function wedge(s, halfDegrees, r, z0, z1, phase) {
  const pts = [[0, 0]];
  for (let i = 0; i < 48; i++) { const a = (phase - halfDegrees + 2 * halfDegrees * i / 47) * Math.PI / 180; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  return s.keep(s.keep(s.keep(s.CrossSection.ofPolygons([pts])).extrude(z1 - z0)).translate([0, 0, z0]));
}

/** Spring fingers cut into a thickened round ring (generate_family.spring_pair). */
function addFingers(s, ring, p, baseT, top) {
  const {Manifold, CrossSection, keep} = s, S = SPRING, n = RING.circular_segments;
  const zRoot = baseT + S.root_above_base, leadStart = top - RING.lead_height, peak = p.radius + S.bow;
  const zPeak = zRoot + S.peak_fraction * (leadStart - zRoot), z0 = zRoot - S.root_overlap;
  const profile = [[p.fingerInner, z0], [p.support, z0], [p.support, zRoot], [peak, zPeak], [peak, leadStart],
    [p.support - RING.lead_radial_reduction + 0.2, top], [p.fingerInner, top]];
  const finger = keep(Manifold.revolve(keep(CrossSection.ofPolygons([profile])), n));
  const span = S.finger_degrees / 2 + S.slot / p.support * 180 / Math.PI;
  const behind = keep(Manifold.cylinder(top + 2, p.fingerInner - S.slot, p.fingerInner - S.slot, n));
  for (let i = 0; i < S.fingers; i++) {
    const phase = 45 + 360 / S.fingers * i;
    ring = keep(ring.subtract(keep(wedge(s, span, p.support + 2, zRoot, top + 1, phase).subtract(behind))));
    ring = keep(ring.add(keep(finger.intersect(wedge(s, S.finger_degrees / 2, peak + 2, z0, top, phase)))));
  }
  // The reference mesh can leave zero-volume slivers at the core boundary; keep the real solid.
  const pieces = ring.decompose(); pieces.forEach(keep);
  const real = pieces.filter(q => q.volume() > 1e-3);
  if (real.length !== 1) throw Error('The spring ring is not one closed solid.');
  const section = keep(real[0].slice(zPeak)).toPolygons().flat();
  if (Math.abs(Math.max(...section.map(([x, y]) => Math.hypot(x, y))) - peak) > 1e-3) throw Error('Spring finger peak check failed.');
  return real[0];
}

/** Gear-side and cap-side rings from one stock ring's core+lip asset (see scripts/build-kraken-ring-assets.py). */
export function buildRings(module, core, input) {
  const p = ringParameters(input), s = scope(module), {Manifold, CrossSection, keep} = s, R = RING, n = R.circular_segments;
  try {
    const stock = s.solid(core), height = stock.boundingBox().max[2];
    if (Math.abs(height - 10.4) > 1e-3) throw Error('Unexpected holder core height.');
    let outline = keep(CrossSection.circle(p.support, n));
    if (p.core === 'pentagon') {
      const angles = Array.from({length: R.corners}, (_, i) => (R.phase_degrees + 360 / R.corners * i) * Math.PI / 180);
      outline = keep(keep(CrossSection.ofPolygons([angles.map(a => [p.corner * Math.cos(a), p.corner * Math.sin(a)])])).add(outline));
    }
    const lipT = R.lip_thickness, leadH = R.lead_height, r = p.radius;
    const straight = keep(keep(outline.extrude(height - leadH - lipT)).translate([0, 0, lipT]));
    const lead = keep(keep(outline.extrude(leadH, 0, 0, [p.scale, p.scale])).translate([0, 0, height - leadH]));
    const keepCyl = keep(keep(Manifold.cylinder(height + 2, p.preserve, p.preserve, n)).translate([0, 0, -1]));
    const lipMask = keep(keep(Manifold.cube([2 * (r + 5), 2 * (r + 5), lipT])).translate([-r - 5, -r - 5, 0]));
    const cap = keep(keep(keep(stock.intersect(keepCyl)).add(keep(keep(straight.add(lead)).subtract(keepCyl)))).add(keep(stock.intersect(lipMask))));
    if (p.core === 'pentagon') {
      // Independent section check from build_pair: five corners at the requested radius.
      const section = keep(cap.slice(height - leadH - 0.1)).toPolygons().flat();
      const reach = Math.max(...section.map(([x, y]) => Math.hypot(x, y)));
      if (Math.abs(reach - p.corner) > 1e-5) throw Error('Pentagon corner radius check failed.');
    }
    const parts = {};
    for (const [side, baseT, reach] of [[p.sides.gear, p.gearT, r + R.flange_radial_reach], [p.sides.cap, p.capT, undefined]]) {
      let body = thicken(s, cap, baseT, p.preserve, reach);
      if (p.core === 'spring') body = addFingers(s, body, p, baseT, height + baseT - lipT);
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
// STL headers are 80 bytes; every one ends with the full credit.
export const ringHeader = (p, side) => `Kraken ring ${mm(p.hole)} ${side.startsWith('gear') ? 'gear side' : 'cap side'}; ${CREDIT}`;
export const nutHeader = p => `Kraken nut ${mm(p.flange)} mm flange; ${CREDIT}`;

/*
 * Spoked spool gear. The asset is humebeam's gear with its web made solid (gear_web.py 'plain':
 * retained teeth, hub, shaft and bearing-seat facets plus planar disc caps). Windows are cut
 * from the Z0-4 disc only, inside R90; the hub above the disc ends at R18.13.
 * Window outline as gear_web_taper.window_face: spoke edges run from root_width/2 at the hub
 * pad radius to tip_width/2 at the window outer radius, measured from the spoke centre line;
 * arcs at both radii; convex corners rounded by an opening offset(-r).offset(+r).
 */
export const GEAR = Object.freeze({disc_thickness: 4, web_inner_radius: 18, change_limit_radius: 90, protected_tooth_band_radius: 95,
  hub_above_disc_radius: 18.13, minimum_feature: 1.35, minimum_opening: 4, minimum_rim_band: 3, petg_density: 1.26});
export const gearPresets = Object.freeze({
  spokes: {count: 8, pad: 42, root: 26, tip: 26, outer: 88, fillet: 3},
  r54t12: {count: 8, pad: 54, root: 35.25, tip: 12, outer: 88, fillet: 3},
  n6r42t12: {count: 6, pad: 42, root: 36.24, tip: 12, outer: 88, fillet: 3},
});
export const gearDefaults = Object.freeze({plain: false, ...gearPresets.spokes});
const ARC_SAG = 1e-4;
export const gearLimits = Object.freeze({count: [3, 12], pad: [25, 80], root: [1.35, 60], tip: [1.35, 60], outer: [40, 90], fillet: [0, 8]});

export function gearParameters(input = {}) {
  for (const k of Object.keys(input)) if (!(k in gearDefaults)) throw Error(`Unknown gear setting: ${k}`);
  const p = {...gearDefaults, ...input}, G = GEAR, names = {count: 'Spoke count', pad: 'Hub pad radius', root: 'Root width', tip: 'Tip width', outer: 'Window outer radius', fillet: 'Corner fillet'};
  if (typeof p.plain !== 'boolean') throw Error('Plain must be on or off.');
  for (const [k, [lo, hi]] of Object.entries(gearLimits)) {
    if (!Number.isFinite(p[k]) || p[k] < lo - 1e-9 || p[k] > hi + 1e-9) throw Error(`${names[k]}: enter ${lo} to ${hi}${k === 'count' ? '' : ' mm'}.`);
    if (k === 'count' ? !Number.isInteger(p[k]) : !onStep(p[k], 0.01)) throw Error(`${names[k]}: use ${k === 'count' ? 'a whole number' : '0.01 mm steps'}.`);
  }
  if (p.plain) return {...p, windows: 0};
  const pitch = 2 * Math.PI / p.count, ri = p.pad, ro = p.outer;
  // Plain-English guards; each says what to change.
  if (ro - ri < 2 * p.fillet + 4) throw Error(`The hub pad (R${mm(ri)}) must stay inside the window: leave at least ${mm(2 * p.fillet + 4)} mm between pad radius and window outer radius (2 × fillet + 4). Shrink the pad or enlarge the window radius.`);
  if (p.root / 2 >= ri || p.tip / 2 >= ro) throw Error('A spoke is wider than its radius allows. Reduce the root or tip width.');
  const ai = Math.asin(p.root / 2 / ri), ao = Math.asin(p.tip / 2 / ro);
  const hubGap = 2 * ri * Math.sin(pitch / 2 - ai), rimGap = 2 * ro * Math.sin(pitch / 2 - ao);
  if (!(hubGap >= G.minimum_opening)) throw Error(`The windows close off at the hub: the opening between spoke roots is ${hubGap > 0 ? hubGap.toFixed(2) : 0} mm, the minimum is ${G.minimum_opening} mm. Use fewer spokes, a narrower root, or a larger hub pad radius.`);
  if (!(rimGap >= G.minimum_opening)) throw Error(`The windows close off at the rim: the opening between spoke tips is ${rimGap > 0 ? rimGap.toFixed(2) : 0} mm, the minimum is ${G.minimum_opening} mm. Use fewer spokes or a narrower tip.`);
  if (Math.min(p.root, p.tip) < G.minimum_feature) throw Error(`Spokes narrower than ${G.minimum_feature} mm (about three 0.45 mm lines) print unreliably. Widen the root or tip.`);
  const rim = G.protected_tooth_band_radius - ro;
  if (rim < G.minimum_rim_band || ro > G.change_limit_radius) throw Error(`Keep the window outer radius at or below ${G.change_limit_radius} mm so a solid rim of at least ${G.minimum_rim_band} mm stays inside the teeth at R${G.protected_tooth_band_radius}.`);
  if (p.fillet > 0 && 2 * p.fillet > Math.min(hubGap, ro - ri)) throw Error(`The ${mm(p.fillet)} mm fillet does not fit the hub-side opening (${hubGap.toFixed(2)} mm). Reduce the fillet.`);
  return {...p, windows: p.count, pitch, hubGap, rimGap, rim, narrowest: Math.min(p.root, p.tip)};
}
export const gearStem = p => p.plain ? 'kraken-spool-gear-plain-web' : `kraken-spool-gear-${p.count}-spokes-pad${mm(p.pad)}-root${mm(p.root)}-tip${mm(p.tip)}-outer${mm(p.outer)}-fillet${mm(p.fillet)}`;
export const gearHeader = p => `Kraken gear ${p.plain ? 'plain web' : p.count + ' spokes'}; ${CREDIT}`;

/** Window outline before rounding, for spoke 0 at +X and the window counter-clockwise from it. */
export function gearWindowPolygon(p) {
  const ri = p.pad, ro = p.outer, pitch = 2 * Math.PI / p.count, ai = Math.asin(p.root / 2 / ri), ao = Math.asin(p.tip / 2 / ro);
  // Sampled arcs deviate from the true arc by at most 0.1 µm (sag = r·θ²/8).
  const arc = (r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / Math.sqrt(8 * ARC_SAG / r))); return Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [r * Math.cos(a), r * Math.sin(a)]; }); };
  return [...arc(ro, ao, pitch - ao), ...arc(ri, pitch - ai, ai)];
}

/** Cut the windows from the plain gear asset. Faces outside the disc web are left untouched by the Boolean. */
export function buildGear(module, plain, input) {
  const p = gearParameters(input), s = scope(module), {Manifold, CrossSection, keep} = s, G = GEAR;
  try {
    const gear = s.solid(plain);
    let out = gear, windowArea = 0;
    if (!p.plain) {
      let window = keep(CrossSection.ofPolygons([gearWindowPolygon(p)]));
      if (p.fillet > 0) {
        const segments = Math.ceil(2 * Math.PI / Math.sqrt(8 * ARC_SAG / p.fillet));
        window = keep(keep(window.offset(-p.fillet, 'Round', 2, segments)).offset(p.fillet, 'Round', 2, segments));
      }
      windowArea = window.area();
      if (!(windowArea > 1) || window.decompose().length !== 1) throw Error('The fillet closes the window. Reduce the fillet or widen the window.');
      const prism = keep(keep(window.extrude(G.disc_thickness + 2)).translate([0, 0, -1]));
      let cutters = prism;
      for (let i = 1; i < p.count; i++) cutters = keep(cutters.add(keep(prism.rotate([0, 0, 360 / p.count * i]))));
      const reach = Math.max(...window.toPolygons().flat().map(([x, y]) => Math.hypot(x, y)));
      if (reach > G.change_limit_radius + 1e-6) throw Error('A window reaches beyond R90.');
      out = keep(gear.subtract(cutters));
      const pieces = out.decompose(); pieces.forEach(keep);
      if (out.status() !== 'NoError' || pieces.length !== 1) throw Error('The spoked gear is not one closed solid.');
    }
    const part = exportSolid(s, out, 'gear');
    return {parameters: p, part: {...part, stem: gearStem(p)}, plainVolume: gear.volume(), windowArea,
      grams: part.volume * G.petg_density / 1000, gramsSaved: (gear.volume() - part.volume) * G.petg_density / 1000};
  } finally { s.release(); }
}
