// Serialization layout follows OCCT BRepTools_ShapeSet::WriteGeometry and
// GeomTools_CurveSet::Print (ASCII BREP V3). This deliberately accepts a narrow
// subset and falls back for other versions, nontranslation locations, or curves.
// https://github.com/Open-Cascade-SAS/OCCT/blob/V7_8_1/src/BRepTools/BRepTools_ShapeSet.cxx
// https://github.com/Open-Cascade-SAS/OCCT/blob/V7_8_1/src/GeomTools/GeomTools_CurveSet.cxx
// Narrow OCCT ASCII BREP V3 preservation check for SameParameter.
// Call only alongside exact BRepCheck, max-tolerance, and volume guards.
const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const finite = (x) => number.test(x) && Number.isFinite(Number(x));
const sections = [
  'Locations',
  'Curve2ds',
  'Curves',
  'Polygon3D',
  'PolygonOnTriangulations',
  'Surfaces',
  'Triangulations',
  'TShapes',
];
function splitSections(text) {
  if (!text.startsWith('\nCASCADE Topology V3, (c) Open Cascade\n'))
    throw Error('version');
  const result = {};
  let last = 0;
  for (let i = 0; i < sections.length; i++) {
    const name = sections[i],
      regex = new RegExp('^' + name + ' (\\d+)\\s*$', 'gm');
    const matches = [...text.matchAll(regex)];
    if (matches.length !== 1 || matches[0].index <= last)
      throw Error('sections');
    const hit = matches[0];
    result[name] = {
      start: hit.index,
      count: Number(hit[1]),
      bodyStart: hit.index + hit[0].length,
    };
    last = hit.index;
  }
  for (let i = 0; i < sections.length; i++) {
    const r = result[sections[i]];
    r.body = text
      .slice(
        r.bodyStart,
        i + 1 < sections.length ? result[sections[i + 1]].start : text.length,
      )
      .trim();
  }
  return result;
}
function curves(section) {
  const records = section.body.split(/\n(?=[1-9] )/);
  if (records.length !== section.count) throw Error('curve count');
  return records;
}
function speedBound(curve, range) {
  const t = curve.trim().split(/\s+/);
  if (t[0] !== '7' || t[1] !== '0' || t[2] !== '0')
    throw Error('unsupported changed curve');
  if (!t.every(finite)) throw Error('curve numbers');
  const v = t.map(Number),
    [degree, n, k] = v.slice(3, 6);
  if (
    !Number.isInteger(degree) ||
    degree < 1 ||
    degree > 25 ||
    !Number.isInteger(n) ||
    n < degree + 1 ||
    !Number.isInteger(k) ||
    k < 2 ||
    t.length !== 6 + 3 * n + 2 * k
  )
    throw Error('spline shape');
  const knots = [],
    mult = [];
  for (let i = 6 + 3 * n; i < v.length; i += 2) {
    knots.push(v[i]);
    mult.push(v[i + 1]);
  }
  if (
    mult[0] !== degree + 1 ||
    mult.at(-1) !== degree + 1 ||
    mult.some((x) => !Number.isInteger(x) || x < 1 || x > degree + 1) ||
    mult.slice(1, -1).some((x) => x > degree) ||
    mult.reduce((a, b) => a + b, 0) !== n + degree + 1
  )
    throw Error('spline multiplicities');
  let minGap = Infinity;
  for (let i = 1; i < k; i++) {
    const gap = knots[i] - knots[i - 1];
    if (!(gap > 0)) throw Error('knot order');
    minGap = Math.min(minGap, gap);
  }
  let maxDistance = 0;
  for (let i = 1; i < n; i++) {
    const a = 6 + 3 * (i - 1),
      b = a + 3;
    maxDistance = Math.max(
      maxDistance,
      Math.hypot(v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]),
    );
  }
  // Extrapolation is limited to 1e-9 of the smallest knot span. On a
  // clamped endpoint polynomial, the derivative Bernstein basis has
  // absolute sum (1+2*overrun/span)^(degree-1), strictly below 2 here.
  if (
    range.some(
      (x) => x < knots[0] - minGap * 1e-9 || x > knots.at(-1) + minGap * 1e-9,
    )
  )
    throw Error('range outside supported domain');
  return (2 * degree * maxDistance) / minGap;
}
export function preservedRepairGeometry(before, after) {
  try {
    const a = splitSections(before),
      b = splitSections(after);
    for (const name of sections)
      if (a[name].count !== b[name].count) throw Error('section count');
    for (const name of [
      'Locations',
      'Curves',
      'Polygon3D',
      'PolygonOnTriangulations',
      'Surfaces',
      'Triangulations',
    ])
      if (a[name].body !== b[name].body) throw Error(name + ' changed');
    if (
      a.Polygon3D.count ||
      a.PolygonOnTriangulations.count ||
      a.Triangulations.count
    )
      throw Error('meshed representation');
    // Direct translations and their integer-power compositions cannot amplify
    // the curve displacement bound. Parse OCCT's ordered location table;
    // references must point backward to already certified translations.
    const locationTokens = a.Locations.body
      ? a.Locations.body.split(/\s+/)
      : [];
    let cursor = 0;
    for (let id = 1; id <= a.Locations.count; id++) {
      const type = locationTokens[cursor++];
      if (type === '1') {
        const chunk = locationTokens.slice(cursor, cursor + 12);
        cursor += 12;
        if (chunk.length !== 12 || !chunk.every(finite))
          throw Error('location layout');
        const matrix = chunk.map(Number);
        for (const [j, want] of [
          [0, 1],
          [1, 0],
          [2, 0],
          [4, 0],
          [5, 1],
          [6, 0],
          [8, 0],
          [9, 0],
          [10, 1],
        ])
          if (matrix[j] !== want) throw Error('non-translation location');
      } else if (type === '2') {
        let references = 0;
        while (locationTokens[cursor] !== '0') {
          const ref = locationTokens[cursor++],
            power = locationTokens[cursor++];
          if (
            !/^[1-9]\d*$/.test(ref ?? '') ||
            Number(ref) >= id ||
            !/^-?\d+$/.test(power ?? '') ||
            !Number.isSafeInteger(Number(power))
          )
            throw Error('location reference');
          references++;
        }
        if (!references) throw Error('empty location composition');
        cursor++;
      } else throw Error('location type');
    }
    if (cursor !== locationTokens.length) throw Error('location layout');
    const curveList = curves(a.Curves),
      left = a.TShapes.body.split(/\n/),
      right = b.TShapes.body.split(/\n/);
    if (left.length !== right.length) throw Error('topology layout');
    let kind = '',
      line = 0,
      shapeCount = 0,
      edgeCurve = null,
      changedRanges = 0,
      maxMovementMM = 0,
      toleranceChanges = 0;
    for (let i = 0; i < left.length; i++) {
      const x = left[i].trim(),
        y = right[i].trim();
      if (/^(Ve|Ed|Wi|Fa|Sh|So|Co|CS)$/.test(x)) {
        if (x !== y) throw Error('topology kind');
        kind = x;
        line = 0;
        edgeCurve = null;
        shapeCount++;
        continue;
      }
      line++;
      if (kind === 'Ed' && line > 1 && /^1\s/.test(x)) {
        const z = x.split(/\s+/);
        if (z.length !== 5 || !/^[1-9]\d*$/.test(z[1]) || edgeCurve !== null)
          throw Error('edge representation');
        edgeCurve = Number(z[1]);
      }
      if (x === y) continue;
      if ((kind === 'Ve' || kind === 'Ed') && line === 1) {
        const xx = x.split(/\s+/),
          yy = y.split(/\s+/),
          size = kind === 'Ve' ? 1 : 4;
        if (
          xx.length !== size ||
          yy.length !== size ||
          !finite(xx[0]) ||
          !finite(yy[0]) ||
          Number(xx[0]) < 0 ||
          Number(yy[0]) < 0 ||
          (size === 4 &&
            (!xx
              .slice(1)
              .concat(yy.slice(1))
              .every((v) => v === '0' || v === '1') ||
              xx[3] !== yy[3]))
        )
          throw Error('tolerance layout');
        toleranceChanges++;
        continue;
      }
      if (kind === 'Ed' && line > 1 && /^[123]\s/.test(x)) {
        const xx = x.split(/\s+/),
          yy = y.split(/\s+/);
        if (
          !edgeCurve ||
          xx.length !== yy.length ||
          xx.slice(0, -2).join(' ') !== yy.slice(0, -2).join(' ') ||
          !xx.slice(-2).every(finite) ||
          !yy.slice(-2).every(finite)
        )
          throw Error('range representation');
        const old = xx.slice(-2).map(Number),
          next = yy.slice(-2).map(Number),
          speed = speedBound(curveList[edgeCurve - 1], [...old, ...next]);
        const movement =
          Math.max(...old.map((v, j) => Math.abs(v - next[j]))) * speed;
        if (!Number.isFinite(movement) || movement > 1e-10)
          throw Error('range movement');
        maxMovementMM = Math.max(maxMovementMM, movement);
        changedRanges++;
        continue;
      }
      throw Error('topology changed');
    }
    if (shapeCount !== a.TShapes.count) throw Error('shape count');
    return { preserved: true, changedRanges, maxMovementMM, toleranceChanges };
  } catch (error) {
    return { preserved: false, reason: error.message };
  }
}
