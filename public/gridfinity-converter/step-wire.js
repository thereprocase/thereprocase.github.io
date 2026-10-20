/** Display-only STEP edges while the full native reader runs. Never used for detection or export.
 * Unsupported units, transforms, topology or curves skip this optional preview entirely. */
export function fastStepWire(buffer) {
  const start = performance.now();
  const s =
    typeof buffer === 'string' ? buffer : new TextDecoder().decode(buffer);
  if (s.length > 50 * 1024 * 1024) throw Error('STEP edge preview size limit.');
  if (/\bMAPPED_ITEM\s*\(/.test(s))
    throw Error('Mapped STEP instances need the native reader.');
  const records = new Map();
  for (const m of s.matchAll(/#(\d+)\s*=\s*([A-Z_0-9]+)\s*\(([^;]*?)\);/g))
    if (
      [
        'MANIFOLD_SOLID_BREP',
        'CLOSED_SHELL',
        'ADVANCED_FACE',
        'FACE_BOUND',
        'FACE_OUTER_BOUND',
        'EDGE_LOOP',
        'ORIENTED_EDGE',
        'ITEM_DEFINED_TRANSFORMATION',
        'EDGE_CURVE',
        'VERTEX_POINT',
        'CARTESIAN_POINT',
        'DIRECTION',
        'AXIS2_PLACEMENT_3D',
        'LINE',
        'CIRCLE',
        'B_SPLINE_CURVE_WITH_KNOTS',
      ].includes(m[2])
    )
      records.set(+m[1], [m[2], m[3]]);
  const scanMS = performance.now() - start;
  function args(s) {
    let list = [],
      level = 0,
      quote = false,
      last = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'") quote = !quote;
      if (quote) continue;
      if (c === '(') level++;
      if (c === ')') level--;
      if (c === ',' && !level) {
        list.push(s.slice(last, i).trim());
        last = i + 1;
      }
    }
    list.push(s.slice(last).trim());
    return list;
  }
  const cache = new Map();
  function get(id) {
    id = +String(id).replace('#', '');
    if (cache.has(id)) return cache.get(id);
    const r = records.get(id);
    if (!r) throw Error('missing' + id);
    const p = { type: r[0], args: args(r[1]) };
    cache.set(id, p);
    return p;
  }
  const nums = (s) => s.slice(1, -1).split(',').map(Number),
    refs = (s) => s.match(/#\d+/g) || [];
  const point = (id) => {
    const record = get(id),
      p = nums(record.args[1]);
    if (
      !['CARTESIAN_POINT', 'DIRECTION'].includes(record.type) ||
      p.length !== 3 ||
      p.some((v) => !Number.isFinite(v))
    )
      throw Error('Unsupported STEP coordinate.');
    return p;
  };
  const solidIds = [...records]
    .filter(([, r]) => r[0] === 'MANIFOLD_SOLID_BREP')
    .map(([id]) => id);
  if (solidIds.length !== 1)
    throw Error('STEP edge preview requires a single solid.');
  const lengthUnits = new Map();
  for (const m of s.matchAll(/#(\d+)\s*=\s*\(([^;]*?)\);/g)) {
    if (/LENGTH_UNIT\s*\(/.test(m[2]))
      lengthUnits.set(
        '#' + m[1],
        /SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(m[2]),
      );
  }
  let lengthContexts = 0;
  for (const m of s.matchAll(
    /GLOBAL_UNIT_ASSIGNED_CONTEXT\s*\(\s*\(([^)]*)\)/g,
  )) {
    const used = refs(m[1]).filter((id) => lengthUnits.has(id));
    if (used.length !== 1 || !lengthUnits.get(used[0]))
      throw Error('STEP edge preview requires millimetre contexts.');
    lengthContexts++;
  }
  if (!lengthContexts) throw Error('STEP edge preview units unavailable.');
  const frame = (id) => {
    const f = get(id);
    if (f.type !== 'AXIS2_PLACEMENT_3D') throw Error('Unsupported placement.');
    return [
      point(f.args[1]),
      f.args[2] === '$' ? [0, 0, 1] : point(f.args[2]),
      f.args[3] === '$' ? [1, 0, 0] : point(f.args[3]),
    ].flat();
  };
  for (const [id, r] of records)
    if (r[0] === 'ITEM_DEFINED_TRANSFORMATION') {
      const a = get(id).args,
        from = frame(a[2]),
        to = frame(a[3]);
      if (from.some((v, i) => Math.abs(v - to[i]) > 1e-9))
        throw Error('Transformed STEP assembly needs the native reader.');
    }
  const edgeIds = new Set(),
    visited = new Set();
  function visit(id) {
    id = Number(String(id).replace('#', ''));
    if (visited.has(id)) return;
    visited.add(id);
    const r = get(id);
    if (r.type === 'EDGE_CURVE') {
      edgeIds.add(id);
      return;
    }
    const expected = {
      MANIFOLD_SOLID_BREP: 2,
      CLOSED_SHELL: 1,
      ADVANCED_FACE: 1,
      FACE_BOUND: 1,
      FACE_OUTER_BOUND: 1,
      EDGE_LOOP: 1,
      ORIENTED_EDGE: 3,
    };
    if (!(r.type in expected)) throw Error('Unsupported STEP topology.');
    for (const ref of refs(r.args[expected[r.type]])) visit(ref);
  }
  // Solid arguments are name,shell; remaining topology indexes refer to STEP attributes.
  const solid = get(solidIds[0]);
  visit(solid.args[1]);
  if (!edgeIds.size) throw Error('No STEP solid edges.');
  const sub = (a, b) => a.map((v, i) => v - b[i]),
    dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    norm = (a) => {
      let l = Math.hypot(...a);
      if (l < 1e-12) throw Error('Invalid STEP direction.');
      return a.map((v) => v / l);
    };
  const verts = [],
    counts = {},
    errors = [];
  function push(a, b) {
    if (verts.length > 6000000 || [...a, ...b].some((v) => !Number.isFinite(v)))
      throw Error('STEP edge preview complexity limit.');
    verts.push(...a, ...b);
  }
  for (const id of edgeIds) {
    try {
      let e = get(id).args,
        a = point(get(e[1]).args[1]),
        b = point(get(e[2]).args[1]),
        curve = get(e[3]);
      counts[curve.type] = (counts[curve.type] || 0) + 1;
      if (curve.type === 'LINE') {
        push(a, b);
        continue;
      }
      if (curve.type === 'CIRCLE') {
        const ca = curve.args,
          ax = get(ca[1]).args,
          o = point(ax[1]),
          z = norm(ax[2] === '$' ? [0, 0, 1] : point(ax[2])),
          x = norm(ax[3] === '$' ? [1, 0, 0] : point(ax[3])),
          y = cross(z, x),
          r = +ca[2];
        if (!Number.isFinite(r) || r <= 0 || Math.abs(dot(z, x)) > 1e-7)
          throw Error('Invalid STEP circle.');
        let u = Math.atan2(dot(sub(a, o), y), dot(sub(a, o), x)),
          v = Math.atan2(dot(sub(b, o), y), dot(sub(b, o), x));
        let delta = v - u;
        if (e[4] === '.T.') {
          if (delta <= 1e-9) delta += 2 * Math.PI;
        } else if (delta >= -1e-9) delta -= 2 * Math.PI;
        const n = Math.max(
          4,
          Math.ceil(
            Math.abs(delta) /
              Math.max(0.08, 2 * Math.acos(Math.max(-1, 1 - 0.1 / r))),
          ),
        );
        let prev = a;
        for (let i = 1; i <= n; i++) {
          let t = u + (delta * i) / n,
            p =
              i === n
                ? b
                : o.map(
                    (q, k) => q + r * (Math.cos(t) * x[k] + Math.sin(t) * y[k]),
                  );
          push(prev, p);
          prev = p;
        }
        continue;
      }
      if (curve.type === 'B_SPLINE_CURVE_WITH_KNOTS') {
        const ca = curve.args,
          p = +ca[1],
          cp = refs(ca[2]).map(point),
          mult = nums(ca[6]),
          ks = nums(ca[7]),
          knots = [];
        if (
          !Number.isInteger(p) ||
          p < 1 ||
          p > 8 ||
          cp.length > 10000 ||
          mult.length !== ks.length ||
          mult.some((v) => !Number.isInteger(v) || v < 1 || v > p + 1) ||
          ks.some((v, i) => !Number.isFinite(v) || (i && v <= ks[i - 1]))
        )
          throw Error('Unsupported STEP spline.');
        for (let i = 0; i < ks.length; i++)
          knots.push(...Array(mult[i]).fill(ks[i]));
        if (knots.length !== cp.length + p + 1)
          throw Error('Invalid STEP spline knots.');
        function at(u) {
          let k = p;
          while (k < cp.length - 1 && u >= knots[k + 1]) k++;
          let d = Array.from({ length: p + 1 }, (_, j) =>
            cp[k - p + j].slice(),
          );
          for (let r = 1; r <= p; r++)
            for (let j = p; j >= r; j--) {
              let lo = knots[k - p + j],
                hi = knots[k + 1 + j - r],
                alpha = hi === lo ? 0 : (u - lo) / (hi - lo);
              d[j] = d[j].map((v, i) => (1 - alpha) * d[j - 1][i] + alpha * v);
            }
          return d[p];
        }
        const distance = (p, q) => Math.hypot(...sub(p, q));
        let low = knots[p],
          high = knots[cp.length],
          first = at(low),
          last = at(high);
        let reversed = distance(first, a) > distance(last, a);
        if (
          distance(reversed ? last : first, a) > 0.05 ||
          distance(reversed ? first : last, b) > 0.05
        ) {
          errors.push({ id, reason: 'trim unsupported' });
          continue;
        }
        function refine(lo, hi, left, right, depth = 0) {
          let us = [0.25, 0.5, 0.75],
            pts = us.map((t) => at(lo + t * (hi - lo))),
            error = Math.max(
              ...pts.map((p, j) =>
                distance(
                  p,
                  left.map((v, k) => v + (right[k] - v) * us[j]),
                ),
              ),
            );
          if (error > 0.05 && depth < 12) {
            refine(lo, (lo + hi) / 2, left, pts[1], depth + 1);
            refine((lo + hi) / 2, hi, pts[1], right, depth + 1);
          } else {
            if (error > 0.05) throw Error('STEP spline sampling limit.');
            push(left, right);
          }
        }
        let unique = [...new Set(knots)].filter((k) => k >= low && k <= high);
        for (let i = 1; i < unique.length; i++)
          refine(unique[i - 1], unique[i], at(unique[i - 1]), at(unique[i]));
        continue;
      }
      errors.push({ id, reason: 'type ' + curve.type });
    } catch (error) {
      errors.push({ id, reason: error.message });
    }
  }
  if (errors.length)
    throw Error('STEP edge preview skipped: ' + errors[0].reason);
  let bounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity, -Infinity, -Infinity],
  ];
  for (let i = 0; i < verts.length; i++) {
    let k = i % 3;
    bounds[0][k] = Math.min(bounds[0][k], verts[i]);
    bounds[1][k] = Math.max(bounds[1][k], verts[i]);
  }
  return {
    vertices: new Float32Array(verts),
    report: {
      scanMS,
      totalMS: performance.now() - start,
      counts,
      segments: verts.length / 6,
      bounds,
      errors: errors.slice(0, 10),
      errorCount: errors.length,
    },
  };
}
