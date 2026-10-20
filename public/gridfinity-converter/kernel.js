/** Local male Gridfinity foot recognition and bounded replacement, millimetres. */
export const STYLES = {
  plain: 'Plain feet',
  magnets: '6 × 2 mm magnets',
  screws: 'M3 screw holes',
  both: 'Magnets + M3 screws',
};
export const LIMITS = {
  fileBytes: 50 * 1024 * 1024,
  triangles: 1000000,
  feet: 128,
};
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1],
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  norm = (a) => Math.hypot(...a),
  unit = (a) => a.map((x) => x / norm(a));
const mult = (a, b) =>
  Array.from({ length: 9 }, (_, i) =>
    [0, 1, 2].reduce(
      (s, k) => s + a[Math.floor(i / 3) * 3 + k] * b[k * 3 + (i % 3)],
      0,
    ),
  );
export const point = (m, p) =>
  [0, 1, 2].map(
    (i) => m[3 * i] * p[0] + m[3 * i + 1] * p[1] + m[3 * i + 2] * p[2],
  );
const rz = (a) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
const affine = (m) => [
  m[0],
  m[3],
  m[6],
  0,
  m[1],
  m[4],
  m[7],
  0,
  m[2],
  m[5],
  m[8],
  0,
  0,
  0,
  0,
  1,
];
function normalDown(n) {
  const b = [0, 0, -1],
    c = dot(n, b);
  if (c > 0.999999) return I;
  if (c < -0.999999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const v = cross(n, b),
    k = [0, -v[2], v[1], v[2], 0, -v[0], -v[1], v[0], 0],
    kk = mult(k, k);
  return I.map((x, i) => x + k[i] + kk[i] / (1 + c));
}
export function meshData(s) {
  const m = s.getMesh();
  return {
    vertices: new Float32Array(m.vertProperties),
    triangles: new Uint32Array(m.triVerts),
    volume: s.volume(),
    bounds: s.boundingBox(),
  };
}
function scope(fn) {
  const all = [],
    keep = (o) => (all.push(o), o);
  try {
    return fn(keep);
  } finally {
    all.reverse().forEach((o) => o.delete());
  }
}
export function checkMesh({ vertices: v, triangles: t }, closed = true) {
  if (!v?.length || !t?.length || v.length % 3 || t.length % 3)
    throw Error('The file has no triangle mesh.');
  if (t.length / 3 > LIMITS.triangles)
    throw Error(
      'This model exceeds the 1,000,000 triangle limit. Export a coarser mesh.',
    );
  for (const n of v)
    if (!Number.isFinite(n) || Math.abs(n) > 1e7)
      throw Error('Invalid or excessively large model coordinates.');
  for (const n of t)
    if (!Number.isInteger(n) || n < 0 || n >= v.length / 3)
      throw Error('Invalid mesh vertex index.');
  if (!closed) return;
  const keys = [];
  for (let i = 0; i < v.length; i += 3)
    keys.push(`${v[i]},${v[i + 1]},${v[i + 2]}`);
  const edges = new Map();
  for (let i = 0; i < t.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = keys[t[i + j]],
        b = keys[t[i + ((j + 1) % 3)]];
      if (a === b) throw Error('The exported mesh has a collapsed edge.');
      const k = a < b ? a + '|' + b : b + '|' + a,
        r = edges.get(k) || [0, 0];
      r[0]++;
      r[1] += a < b ? 1 : -1;
      edges.set(k, r);
    }
  if ([...edges.values()].some(([n, w]) => n !== 2 || w !== 0))
    throw Error(
      'Mesh is not closed with consistent face winding. Repair the source mesh before converting.',
    );
}
export function importSolid(module, data, scale = 1) {
  checkMesh(data, false);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1000)
    throw Error('Invalid unit scale.');
  const v = new Float32Array(data.vertices.length);
  for (let i = 0; i < v.length; i++) v[i] = data.vertices[i] * scale;
  // Recenter before welding so a large assembly translation does not inflate tolerance.
  const center = [0, 1, 2].map((k) => {
    let lo = Infinity,
      hi = -Infinity;
    for (let i = k; i < v.length; i += 3) {
      lo = Math.min(lo, v[i]);
      hi = Math.max(hi, v[i]);
    }
    return (lo + hi) / 2;
  });
  for (let i = 0; i < v.length; i++) v[i] -= center[i % 3];
  const mesh = new module.Mesh({
    numProp: 3,
    vertProperties: v,
    triVerts: new Uint32Array(data.triangles),
  });
  const merged = mesh.merge();
  let s;
  try {
    s = new module.Manifold(mesh);
  } catch (e) {
    throw Error(
      `This is not a closed solid (${e.message}). Repair open edges or inconsistent face winding in your modeler, then retry.`,
    );
  }
  if (s.status() !== 'NoError') {
    const status = s.status();
    s.delete();
    throw Error(
      `This is not a closed solid (${status}). Repair open edges or inconsistent face winding in your modeler, then retry. No holes were filled automatically.`,
    );
  }
  if (s.volume() < 0) {
    s.delete();
    const t = new Uint32Array(data.triangles);
    for (let i = 0; i < t.length; i += 3)
      [t[i + 1], t[i + 2]] = [t[i + 2], t[i + 1]];
    const fixed = new module.Mesh({
      numProp: 3,
      vertProperties: v,
      triVerts: t,
    });
    fixed.merge();
    s = new module.Manifold(fixed);
  }
  if (s.volume() <= 1e-6) {
    s.delete();
    throw Error('The file does not enclose a measurable solid volume.');
  }
  const shifted = s.translate(center);
  s.delete();
  s = shifted;
  const parts = s.decompose();
  s.delete();
  // Union touching/overlapping shells, then offer each disconnected part separately.
  let union;
  try {
    union = module.Manifold.union(parts);
  } finally {
    parts.forEach((p) => p.delete());
  }
  if (union.status() !== 'NoError') {
    union.delete();
    throw Error(
      'Intersecting shells could not be combined. Repair the source model.',
    );
  }
  const bodies = union.decompose();
  union.delete();
  bodies.sort((a, b) => b.volume() - a.volume());
  if (bodies.length > 64) {
    bodies.forEach((s) => s.delete());
    throw Error(
      'More than 64 separate solids. Export only the part you want to convert.',
    );
  }
  return { bodies, merged };
}
function rounded(cx, cy, w, r, z) {
  const a = [];
  for (const [x, y, start] of [
    [cx + w / 2 - r, cy - w / 2 + r, -90],
    [cx + w / 2 - r, cy + w / 2 - r, 0],
    [cx - w / 2 + r, cy + w / 2 - r, 90],
    [cx - w / 2 + r, cy - w / 2 + r, 180],
  ])
    for (let j = 0; j <= 16; j++) {
      const t = ((start + (j * 90) / 16) * Math.PI) / 180;
      a.push([x + r * Math.cos(t), y + r * Math.sin(t), z]);
    }
  return a;
}
export function foot(module, cx = 0, cy = 0, bottom = 0, seam = 4.75, fit = 0) {
  const sections = [
    [0, 35.6, 0.8],
    [0.8, 37.2, 1.6],
    [2.6, 37.2, 1.6],
    [4.75, 41.5, 3.75],
  ];
  if (seam > 4.75) sections.push([seam, 41.5, 3.75]);
  const rings = sections.map(([z, w, r]) =>
      rounded(cx, cy, w + 2 * fit, r + fit, z + bottom),
    ),
    vertices = rings.flat(),
    n = rings[0].length,
    triangles = [],
    lo = vertices.length;
  vertices.push([cx, cy, bottom]);
  const hi = vertices.length;
  vertices.push([cx, cy, bottom + seam]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    triangles.push(
      [lo, j, i],
      [hi, (rings.length - 1) * n + i, (rings.length - 1) * n + j],
    );
  }
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = k * n + i,
        b = k * n + j,
        c = (k + 1) * n + j,
        d = (k + 1) * n + i;
      triangles.push([a, b, c], [a, c, d]);
    }
  return new module.Manifold(
    new module.Mesh({
      numProp: 3,
      vertProperties: new Float32Array(vertices.flat()),
      triVerts: new Uint32Array(triangles.flat()),
    }),
  );
}
function candidates(data) {
  const bins = [];
  const v = data.vertices,
    t = data.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3,
      b = t[i + 1] * 3,
      c = t[i + 2] * 3,
      ab = [0, 1, 2].map((k) => v[b + k] - v[a + k]),
      ac = [0, 1, 2].map((k) => v[c + k] - v[a + k]),
      n = cross(ab, ac),
      area = norm(n) / 2;
    if (area < 5) continue;
    const dir = unit(n);
    const bin = bins.find((b) => dot(b.n, dir) > 0.9995);
    if (bin) bin.area += area;
    else bins.push({ n: dir, area });
  }
  bins.sort((a, b) => b.area - a.area);
  const normals = bins.slice(0, 10).map((b) => b.n);
  for (const n of [
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
  ])
    if (!normals.some((x) => dot(x, n) > 0.9995)) normals.push(n);
  return normals;
}
function getYaw(section) {
  let c = 0,
    s = 0;
  for (const poly of section.toPolygons())
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy);
      if (l < 5) continue;
      const angle = Math.atan2(dy, dx);
      c += l * Math.cos(4 * angle);
      s += l * Math.sin(4 * angle);
    }
  return Math.hypot(c, s) > 1 ? Math.atan2(s, c) / 4 : 0;
}
function sectionParts(shape, z, keep) {
  const cs = keep(shape.slice(z));
  return cs.decompose().map((o) => {
    keep(o);
    const b = o.bounds();
    return {
      shape: o,
      min: b.min,
      max: b.max,
      x: (b.min[0] + b.max[0]) / 2,
      y: (b.min[1] + b.max[1]) / 2,
      w: b.max[0] - b.min[0],
      h: b.max[1] - b.min[1],
      area: o.area(),
    };
  });
}
function inspect(shape, module, bottom, keep) {
  const lower = sectionParts(shape, bottom + 0.2, keep),
    middle = sectionParts(shape, bottom + 1.6, keep),
    upper = sectionParts(shape, bottom + 4.5, keep),
    result = [];
  for (const p of lower) {
    if (
      p.w < 34 ||
      p.w > 38 ||
      p.h < 34 ||
      p.h > 38 ||
      Math.abs(p.w - p.h) > 0.7 ||
      p.area / (p.w * p.h) < 0.72
    )
      continue;
    const match = (parts) =>
        parts.find(
          (q) =>
            Math.hypot(q.x - p.x, q.y - p.y) < 0.6 && q.w < 42.2 && q.h < 42.2,
        ),
      mid = match(middle),
      top = match(upper);
    if (!mid || !top) continue;
    if (
      top.w - mid.w < 2 ||
      top.h - mid.h < 2 ||
      top.w < 39.5 ||
      top.h < 39.5 ||
      mid.w - p.w < 0.3 ||
      mid.h - p.h < 0.3
    )
      continue;
    const deviation =
      (Math.abs(p.w - 36) +
        Math.abs(p.h - 36) +
        Math.abs(mid.w - 37.2) +
        Math.abs(mid.h - 37.2) +
        Math.abs(top.w - 41) +
        Math.abs(top.h - 41)) /
      6;
    const confidence = Math.max(0, Math.min(1, 1 - deviation / 1.5));
    if (confidence < 0.55) continue;
    let magnets = 0,
      screws = 0;
    for (const dx of [-13, 13])
      for (const dy of [-13, 13]) {
        const disc = (r) =>
          keep(
            keep(module.CrossSection.circle(r, 32)).translate([
              p.x + dx,
              p.y + dy,
            ]),
          );
        const broad = disc(2.8),
          small = disc(1.1);
        if (keep(p.shape.intersect(broad)).area() < broad.area() * 0.1)
          magnets++;
        if (keep(mid.shape.intersect(small)).area() < small.area() * 0.1) {
          const slice = keep(shape.slice(bottom + 3.5));
          if (keep(slice.intersect(small)).area() < small.area() * 0.1)
            screws++;
        }
      }
    result.push({
      x: p.x,
      y: p.y,
      confidence,
      magnetCount: magnets,
      screwCount: screws,
      sourceStyle: magnets
        ? screws
          ? 'Magnets + screws'
          : 'Magnet pockets'
        : screws
          ? 'Screw holes'
          : 'Plain',
      measurements: {
        lower: [p.w, p.h],
        middle: [mid.w, mid.h],
        upper: [top.w, top.h],
      },
    });
  }
  if (result.length > LIMITS.feet)
    throw Error('More than 128 feet detected. Export a smaller part.');
  for (const p of result) {
    p.gridNeighbors = result.filter(
      (q) => q !== p && Math.abs(Math.hypot(q.x - p.x, q.y - p.y) - 42) < 0.65,
    ).length;
  }
  return result;
}
const AXES = {
  '-z': [0, 0, -1],
  '+z': [0, 0, 1],
  '-x': [-1, 0, 0],
  '+x': [1, 0, 0],
  '-y': [0, -1, 0],
  '+y': [0, 1, 0],
};
export function fitGrid(feet) {
  if (!feet.length)
    return { pitch: 42, x: 0, y: 0, matched: 0, total: 0, maxResidual: 0 };
  const residual = (p, a) =>
    Math.hypot(
      p.x - a.x - Math.round((p.x - a.x) / 42) * 42,
      p.y - a.y - Math.round((p.y - a.y) / 42) * 42,
    );
  let anchor = feet[0],
    best = -1;
  for (const a of feet) {
    const score = feet.reduce(
      (s, p) => s + (residual(p, a) < 0.6 ? p.confidence : 0),
      0,
    );
    if (score > best) {
      best = score;
      anchor = a;
    }
  }
  const inliers = feet.filter((p) => residual(p, anchor) < 0.6),
    origin = { x: 0, y: 0 };
  for (const k of ['x', 'y'])
    origin[k] =
      inliers.reduce(
        (s, p) => s + p[k] - Math.round((p[k] - anchor[k]) / 42) * 42,
        0,
      ) / inliers.length;
  let maxResidual = 0,
    matched = 0;
  for (const p of feet) {
    p.sourceX = p.x;
    p.sourceY = p.y;
    p.column = Math.round((p.x - origin.x) / 42);
    p.row = Math.round((p.y - origin.y) / 42);
    p.gridResidual = residual(p, origin);
    p.gridMatch = p.gridResidual < 0.6;
    if (p.gridMatch) {
      p.x = origin.x + p.column * 42;
      p.y = origin.y + p.row * 42;
      matched++;
      maxResidual = Math.max(maxResidual, p.gridResidual);
    }
  }
  return { pitch: 42, ...origin, matched, total: feet.length, maxResidual };
}
export function detect(module, shape, options = {}) {
  const orientation = options.orientation ?? 'auto',
    yaw = Number(options.yaw ?? 0),
    bottom = Number(options.bottom ?? 0);
  if (orientation !== 'auto' && !AXES[orientation])
    throw Error('Choose a base-facing direction.');
  if (
    !Number.isFinite(yaw) ||
    Math.abs(yaw) > 360 ||
    !Number.isFinite(bottom) ||
    Math.abs(bottom) > 2000
  )
    throw Error('Invalid orientation or bottom-plane setting.');
  const normals =
    orientation === 'auto' ? candidates(meshData(shape)) : [AXES[orientation]];
  let best;
  for (const n of normals) {
    const proposal = scope((keep) => {
      const base = normalDown(n),
        first = keep(shape.transform(affine(base))),
        b = first.boundingBox(),
        slice = keep(first.slice(b.min[2] + bottom + 0.2)),
        autoYaw = getYaw(slice),
        rotation = mult(rz(-autoYaw + (yaw * Math.PI) / 180), base),
        rotated = keep(shape.transform(affine(rotation))),
        bb = rotated.boundingBox(),
        translation = [
          -(bb.min[0] + bb.max[0]) / 2,
          -(bb.min[1] + bb.max[1]) / 2,
          -bb.min[2],
        ],
        aligned = keep(rotated.translate(translation)),
        feet = inspect(aligned, module, bottom, keep);
      const grid = fitGrid(feet);
      return {
        rotation,
        translation,
        normal: n,
        yawDegrees: ((-autoYaw + (yaw * Math.PI) / 180) * 180) / Math.PI,
        feet,
        grid,
        score: feet.reduce(
          (sum, p) => sum + (p.gridMatch ? p.confidence : 0),
          0,
        ),
        bounds: aligned.boundingBox(),
      };
    });
    if (!best || proposal.score > best.score + 0.0001) best = proposal;
  }
  const aligned = shape.transform(affine(best.rotation)),
    shifted = aligned.translate(best.translation);
  aligned.delete();
  const result = { ...best, bottom, geometry: meshData(shifted) };
  shifted.delete();
  result.feet.sort((a, b) => a.y - b.y || a.x - b.x);
  result.feet.forEach((p, i) => (p.id = i + 1));
  return result;
}
export function align(module, shape, detection) {
  const r = shape.transform(affine(detection.rotation)),
    s = r.translate(detection.translation);
  r.delete();
  // Establish the comparison baseline in the same float32 coordinates shown
  // in the viewer and written to mesh files, before any foot is edited.
  const data = meshData(s),
    mesh = new module.Mesh({
      numProp: 3,
      vertProperties: data.vertices,
      triVerts: data.triangles,
    });
  mesh.merge();
  const aligned = new module.Manifold(mesh);
  if (
    aligned.status() !== 'NoError' ||
    Math.abs(aligned.volume() - s.volume()) > Math.max(0.001, s.volume() * 1e-6)
  ) {
    s.delete();
    aligned.delete();
    throw Error(
      'Model could not be represented accurately in the aligned mesh frame.',
    );
  }
  s.delete();
  return aligned;
}
export function convert(module, original, input) {
  return scope((keep) => {
    const { Manifold: M } = module,
      style = input.style ?? 'plain',
      bottom = Number(input.bottom ?? 0),
      height = Number(input.height ?? 4.75),
      fit = Number(input.fit ?? 0),
      magnetDiameter = Number(input.magnetDiameter ?? 6.5),
      magnetDepth = Number(input.magnetDepth ?? 2.4),
      screwDiameter = Number(input.screwDiameter ?? 3),
      requestedScrewDepth = Number(input.screwDepth ?? 6),
      roof = Number(input.roof ?? 0.8);
    let screwDepth = requestedScrewDepth;
    if (!Object.hasOwn(STYLES, style))
      throw Error('Choose a supported foot style.');
    for (const [name, value, lo, hi] of [
      ['bottom', bottom, -2000, 2000],
      ['replacement height', height, 4.75, 10],
      ['fit allowance', fit, -0.15, 0.15],
      ['magnet diameter', magnetDiameter, 5.5, 7],
      ['magnet depth', magnetDepth, 1, 3],
      ['screw diameter', screwDiameter, 2.5, 3.6],
      ['screw depth', screwDepth, 2, 8],
      ['roof', roof, 0.6, 2],
    ])
      if (!Number.isFinite(value) || value < lo || value > hi)
        throw Error(`${name}: use ${lo}–${hi} mm.`);
    const feet = input.feet;
    if (!Array.isArray(feet) || !feet.length || feet.length > LIMITS.feet)
      throw Error('Select between 1 and 128 feet.');
    for (let i = 0; i < feet.length; i++) {
      const p = feet[i];
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.max(Math.abs(p.x), Math.abs(p.y)) > 2000
      )
        throw Error('Invalid foot center.');
      for (const k of ['x', 'y'])
        if (
          Math.abs(
            (p[k] - feet[0][k]) / 42 - Math.round((p[k] - feet[0][k]) / 42),
          ) > 1e-5
        )
          throw Error(
            'All replacement feet must share a fixed 42 mm grid. Correct the grid origin or selected cells.',
          );
      for (let j = 0; j < i; j++)
        if (Math.hypot(p.x - feet[j].x, p.y - feet[j].y) < 0.01)
          throw Error('The same grid cell is selected more than once.');
    }
    const box = (size, pos) => keep(keep(M.cube(size)).translate(pos)),
      bore = (x, y, r, z, h) =>
        keep(keep(M.cylinder(h, r, r, 64)).translate([x, y, z])),
      cuts = [],
      additions = [],
      holes = [],
      regions = [];
    for (const [i, p] of feet.entries()) {
      const sx = p.sourceX ?? p.x,
        sy = p.sourceY ?? p.y;
      if (
        !Number.isFinite(sx) ||
        !Number.isFinite(sy) ||
        Math.hypot(sx - p.x, sy - p.y) > 1
      )
        throw Error(
          'Grid correction exceeds 1 mm. Reorient or redetect the original feet.',
        );
      const cut = box(
        [41.98 + Math.abs(sx - p.x), 41.98 + Math.abs(sy - p.y), height + 0.02],
        [Math.min(sx, p.x) - 20.99, Math.min(sy, p.y) - 20.99, bottom - 0.02],
      );
      cuts.push(cut);
      regions.push(cut);
      const top = keep(foot(module, p.x, p.y, bottom, height + 0.02, fit));
      additions.push(top);
      regions.push(top);
      // Hollow bins attach through their perimeter walls, not their empty center.
      // Measure actual overlap with the replacement's full rounded profile.
      const seamSlice = box(
        [42, 42, 0.02],
        [p.x - 21, p.y - 21, bottom + height],
      );
      const contact = keep(keep(original.intersect(top)).intersect(seamSlice));
      if (contact.volume() < 0.02)
        throw Error(
          `Foot ${i + 1} has no substantial material contact with the part at the replacement seam. Check its center and seam height.`,
        );
    }
    let result = keep(
      keep(original.subtract(keep(M.union(cuts)))).add(
        keep(M.union(additions)),
      ),
    );
    if (input.fitScrewDepth && ['screws', 'both'].includes(style)) {
      const fits = (depth) =>
        feet.every((p) =>
          [-13, 13].every((dx) =>
            [-13, 13].every((dy) => {
              const cover = bore(
                p.x + dx,
                p.y + dy,
                screwDiameter / 2,
                bottom + depth,
                roof,
              );
              return (
                keep(cover.subtract(result)).volume() <=
                Math.max(0.001, cover.volume() * 0.001)
              );
            }),
          ),
        );
      if (!fits(screwDepth)) {
        let candidate = Math.floor((screwDepth - 0.001) * 10) / 10;
        while (candidate >= 2 && !fits(candidate))
          candidate = Math.round((candidate - 0.1) * 10) / 10;
        if (candidate < 2)
          throw Error(
            'No screw depth of at least 2 mm fits with the requested solid roof. Choose plain feet or magnets.',
          );
        screwDepth = candidate;
      }
    }
    for (const p of feet) {
      for (const dx of [-13, 13])
        for (const dy of [-13, 13]) {
          const x = p.x + dx,
            y = p.y + dy;
          if (style === 'magnets' || style === 'both') {
            const h = bore(
              x,
              y,
              magnetDiameter / 2,
              bottom - 0.02,
              magnetDepth + 0.02,
            );
            holes.push(h);
            regions.push(h);
          }
          if (style === 'screws' || style === 'both') {
            const h = bore(
              x,
              y,
              screwDiameter / 2,
              bottom - 0.02,
              screwDepth + 0.02,
            );
            holes.push(h);
            regions.push(h);
          }
        }
    }
    for (const [i, p] of feet.entries())
      for (const dx of [-13, 13])
        for (const dy of [-13, 13]) {
          const checks = [];
          if (style === 'magnets' || style === 'both')
            checks.push([magnetDiameter / 2, magnetDepth]);
          if (style === 'screws' || style === 'both')
            checks.push([screwDiameter / 2, screwDepth]);
          for (const [radius, depth] of checks) {
            const cover = bore(
                p.x + dx,
                p.y + dy,
                radius,
                bottom + depth,
                roof,
              ),
              missing = keep(cover.subtract(result)).volume();
            if (missing > Math.max(0.001, cover.volume() * 0.001))
              throw Error(
                `Foot ${i + 1}: the requested hole lacks ${roof} mm of solid roof. Reduce hole depth or choose another style.`,
              );
          }
        }
    if (holes.length) result = keep(result.subtract(keep(M.union(holes))));
    if (result.status() !== 'NoError' || result.volume() <= 0)
      throw Error('The replacement did not produce a valid solid.');
    let normalizationMM = 0;
    try {
      checkMesh(meshData(result));
    } catch (error) {
      // Rotated imports can leave distinct double vertices at the same float32
      // coordinate. Normalize only below export precision; all preservation checks
      // below run against this final solid, not the pre-normalization geometry.
      const bounds = result.boundingBox(),
        magnitude = Math.max(
          1,
          ...bounds.min.map(Math.abs),
          ...bounds.max.map(Math.abs),
        ),
        precision = 0.00001 + 2 * 2 ** (Math.floor(Math.log2(magnitude)) - 23);
      let fixed = false;
      for (const tolerance of [0, precision, precision * 4]) {
        const candidate = tolerance ? keep(result.simplify(tolerance)) : result,
          data = meshData(candidate),
          mesh = new module.Mesh({
            numProp: 3,
            vertProperties: data.vertices,
            triVerts: data.triangles,
          });
        mesh.merge();
        const clean = keep(new M(mesh));
        if (clean.status() !== 'NoError') continue;
        try {
          checkMesh(meshData(clean));
        } catch {
          continue;
        }
        const change =
          keep(clean.subtract(result)).volume() +
          keep(result.subtract(clean)).volume();
        if (change > Math.max(0.001, result.volume() * 1e-7)) continue;
        result = clean;
        normalizationMM = tolerance;
        fixed = true;
        break;
      }
      if (!fixed) throw error;
    }
    const components = result.decompose();
    components.forEach(keep);
    if (components.length !== 1)
      throw Error(
        'Replacement would split the part or leave a disconnected foot. Check the selected regions.',
      );
    const added = keep(result.subtract(original)),
      removed = keep(original.subtract(result)),
      allowed = keep(M.union(regions)),
      outsideChange =
        keep(added.subtract(allowed)).volume() +
        keep(removed.subtract(allowed)).volume();
    if (outsideChange > Math.max(0.001, original.volume() * 1e-8))
      throw Error(
        'Preservation check failed outside the selected edit regions: ' +
          outsideChange +
          ' mm³.',
      );
    const geometry = meshData(result);
    checkMesh(geometry);
    return {
      geometry,
      added: meshData(added),
      removed: meshData(removed),
      report: {
        style,
        pitch: 42,
        feet: feet.map((p) => ({
          x: p.x,
          y: p.y,
          sourceX: p.sourceX ?? p.x,
          sourceY: p.sourceY ?? p.y,
        })),
        bottom,
        height,
        fit,
        magnetDiameter,
        magnetDepth,
        screwDiameter,
        screwDepth,
        requestedScrewDepth,
        fitScrewDepth: Boolean(input.fitScrewDepth),
        minimumRoof: roof,
        originalVolume: original.volume(),
        convertedVolume: result.volume(),
        addedVolume: added.volume(),
        removedVolume: removed.volume(),
        outsideChange,
        normalizationMM,
        closedMesh: true,
        connectedSolids: 1,
      },
    };
  });
}
export function restoreCoordinates(geometry, detection) {
  const v = new Float32Array(geometry.vertices.length),
    r = detection.rotation,
    t = detection.translation;
  for (let i = 0; i < v.length; i += 3) {
    const p = [0, 1, 2].map((k) => geometry.vertices[i + k] - t[k]);
    for (let k = 0; k < 3; k++)
      v[i + k] = r[k] * p[0] + r[k + 3] * p[1] + r[k + 6] * p[2];
  }
  return { ...geometry, vertices: v };
}
export function binarySTL({ vertices: v, triangles: t }) {
  const buffer = new ArrayBuffer(84 + (t.length / 3) * 50),
    d = new DataView(buffer);
  new Uint8Array(buffer).set(
    new TextEncoder().encode(
      'Gridfinity male base converter; mm; geometric checks only',
    ),
  );
  d.setUint32(80, t.length / 3, true);
  for (let i = 0; i < t.length; i += 3) {
    const o = 84 + (i / 3) * 50;
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        d.setFloat32(o + 12 + j * 12 + k * 4, v[t[i + j] * 3 + k], true);
  }
  return buffer;
}
