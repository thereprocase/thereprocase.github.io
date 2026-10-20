import * as THREE from 'three';
import { LIMITS } from './kernel.js?v=converter-1';
import {
  unzipSync,
  strFromU8,
  zipSync,
  strToU8,
} from './vendor/three/libs/fflate.module.js';
export const extensions = [
  'stl',
  'obj',
  '3mf',
  'ply',
  'off',
  'gltf',
  'glb',
  'step',
  'stp',
  'iges',
  'igs',
  'brep',
  'brp',
  'amf',
  'dae',
  'fbx',
];
const units = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  meter: 1000,
  inch: 25.4,
  foot: 304.8,
};
export function geometryData(g, matrix = new THREE.Matrix4()) {
  const position = g.getAttribute('position');
  if (!position) throw Error('The model has no mesh positions.');
  const v = new Float32Array(position.count * 3),
    p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(matrix);
    v.set([p.x, p.y, p.z], i * 3);
  }
  const index = g.index,
    t = index
      ? new Uint32Array(index.array)
      : Uint32Array.from({ length: position.count }, (_, i) => i);
  if (matrix.determinant() < 0)
    for (let i = 0; i < t.length; i += 3)
      [t[i + 1], t[i + 2]] = [t[i + 2], t[i + 1]];
  return { vertices: v, triangles: t };
}
function combine(meshes) {
  let nv = 0,
    nt = 0;
  for (const m of meshes) {
    nv += m.vertices.length;
    nt += m.triangles.length;
  }
  if (nt / 3 > LIMITS.triangles)
    throw Error('More than 1,000,000 triangles. Export a coarser model.');
  if (!nt) throw Error('No triangle surfaces found in this file.');
  const v = new Float32Array(nv),
    t = new Uint32Array(nt);
  let vi = 0,
    ti = 0;
  for (const m of meshes) {
    v.set(m.vertices, vi);
    for (let i = 0; i < m.triangles.length; i++)
      t[ti + i] = m.triangles[i] + vi / 3;
    vi += m.vertices.length;
    ti += m.triangles.length;
  }
  return { vertices: v, triangles: t };
}
function fromScene(scene) {
  scene.updateMatrixWorld(true);
  const meshes = [],
    resources = new Set();
  scene.traverse((o) => {
    if (o.isSkinnedMesh)
      throw Error(
        'Export a baked, static pose before converting a skinned model.',
      );
    if (o.isMesh) {
      meshes.push(geometryData(o.geometry, o.matrixWorld));
      resources.add(o.geometry);
      for (const m of [].concat(o.material ?? [])) {
        resources.add(m);
        for (const value of Object.values(m))
          if (value?.isTexture) resources.add(value);
      }
    }
  });
  const result = combine(meshes);
  resources.forEach((r) => r.dispose());
  return result;
}
function xml(bytes) {
  const d = new DOMParser().parseFromString(
    typeof bytes === 'string' ? bytes : strFromU8(bytes),
    'application/xml',
  );
  if (d.getElementsByTagName('parsererror').length)
    throw Error('Invalid model XML.');
  return d;
}
const children = (node, name) =>
    Array.from(node.children).filter((n) => n.localName === name),
  attr = (node, name) =>
    Array.from(node.attributes).find((a) => a.localName === name)?.value;
function modelPath(path, relative = '') {
  const u = new URL(path, 'https://local.invalid/' + relative);
  return decodeURIComponent(u.pathname.replace(/^\//, ''));
}
export function parse3MF(buffer) {
  let size = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => {
        size += file.originalSize;
        count++;
        if (size > 200 * 1024 * 1024 || count > 5000)
          throw Error('3MF archive is too large when expanded.');
        return /\.(model|rels)$/i.test(file.name);
      },
    }),
    models = new Map();
  const getModel = (path) => {
    if (models.has(path)) return models.get(path);
    const file = files[path];
    if (!file) throw Error('Missing referenced 3MF model: ' + path);
    const doc = xml(file),
      root = doc.documentElement,
      factor = units[root.getAttribute('unit') || 'millimeter'];
    if (!factor) throw Error('Unsupported 3MF unit.');
    const resources = children(root, 'resources')[0];
    if (!resources) throw Error('3MF resources are missing.');
    const objects = new Map(
      children(resources, 'object').map((o) => [o.getAttribute('id'), o]),
    );
    const model = { root, factor, objects };
    models.set(path, model);
    return model;
  };
  let rootPath = '3D/3dmodel.model';
  if (files['_rels/.rels']) {
    const rel = xml(files['_rels/.rels']);
    const entry = Array.from(rel.documentElement.children).find((n) =>
      (n.getAttribute('Type') || '').endsWith('3dmodel'),
    );
    if (entry) rootPath = modelPath(entry.getAttribute('Target'));
  }
  if (!files[rootPath])
    rootPath = Object.keys(files).find((p) => /\.model$/i.test(p));
  if (!rootPath) throw Error('No 3MF model found.');
  const meshes = [],
    stack = new Set();
  let instances = 0;
  const transform = (text, factor) => {
    const m = new THREE.Matrix4();
    if (!text) return m;
    const a = text.trim().split(/\s+/).map(Number);
    if (a.length !== 12 || a.some((n) => !Number.isFinite(n)))
      throw Error('Invalid 3MF transform.');
    return m.set(
      a[0],
      a[3],
      a[6],
      a[9] * factor,
      a[1],
      a[4],
      a[7],
      a[10] * factor,
      a[2],
      a[5],
      a[8],
      a[11] * factor,
      0,
      0,
      0,
      1,
    );
  };
  function visit(path, id, parent, depth = 0) {
    const key = path + '#' + id;
    if (depth > 32 || stack.has(key) || ++instances > 2000)
      throw Error('Cyclic or overly complex 3MF assembly.');
    stack.add(key);
    const model = getModel(path),
      object = model.objects.get(id);
    if (!object) throw Error('3MF object reference was not found.');
    const mesh = children(object, 'mesh')[0];
    if (mesh) {
      const vs = children(children(mesh, 'vertices')[0], 'vertex'),
        ts = children(children(mesh, 'triangles')[0], 'triangle'),
        g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          vs.flatMap((n) =>
            ['x', 'y', 'z'].map(
              (k) => Number(n.getAttribute(k)) * model.factor,
            ),
          ),
          3,
        ),
      );
      g.setIndex(
        ts.flatMap((n) =>
          ['v1', 'v2', 'v3'].map((k) => Number(n.getAttribute(k))),
        ),
      );
      meshes.push(geometryData(g, parent));
      g.dispose();
    }
    const components = children(object, 'components')[0];
    if (components)
      for (const c of children(components, 'component')) {
        const target = attr(c, 'path'),
          next = target ? modelPath(target, path) : path;
        visit(
          next,
          c.getAttribute('objectid'),
          parent
            .clone()
            .multiply(transform(c.getAttribute('transform'), model.factor)),
          depth + 1,
        );
      }
    stack.delete(key);
  }
  const root = getModel(rootPath),
    build = children(root.root, 'build')[0];
  if (!build) throw Error('3MF build list is missing.');
  for (const item of children(build, 'item')) {
    if (item.getAttribute('printable') === '0') continue;
    visit(
      attr(item, 'path') ? modelPath(attr(item, 'path'), rootPath) : rootPath,
      item.getAttribute('objectid'),
      transform(item.getAttribute('transform'), root.factor),
    );
  }
  return combine(meshes);
}
function parseOFF(text) {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);
  if (!/^OFF(?:\s|$)/.test(rows[0]))
    throw Error('Expected an OFF polygon mesh.');
  const first = rows.shift().slice(3).trim();
  if (first) rows.unshift(first);
  const [nv, nf] = rows.shift().split(/\s+/).map(Number);
  if (
    !Number.isInteger(nv) ||
    !Number.isInteger(nf) ||
    nv < 1 ||
    nf < 1 ||
    nv > 3000000 ||
    nf > LIMITS.triangles
  )
    throw Error('Invalid OFF counts.');
  const vertices = rows
      .splice(0, nv)
      .flatMap((r) => r.split(/\s+/).slice(0, 3).map(Number)),
    triangles = [];
  for (const row of rows.slice(0, nf)) {
    const a = row.split(/\s+/).map(Number),
      n = a.shift();
    if (n !== a.length || n < 3) throw Error('Invalid OFF polygon.');
    if (n === 3) {
      triangles.push(...a);
      continue;
    }
    const points = a.map(
        (i) => new THREE.Vector3(...vertices.slice(i * 3, i * 3 + 3)),
      ),
      normal = new THREE.Vector3();
    for (let i = 0; i < n; i++)
      normal.add(
        new THREE.Vector3().crossVectors(points[i], points[(i + 1) % n]),
      );
    const drop = [
        Math.abs(normal.x),
        Math.abs(normal.y),
        Math.abs(normal.z),
      ].indexOf(
        Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)),
      ),
      axes = [0, 1, 2].filter((k) => k !== drop),
      contour = points.map(
        (p) =>
          new THREE.Vector2(p.getComponent(axes[0]), p.getComponent(axes[1])),
      );
    for (const tri of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const ids = tri.map((i) => a[i]),
        ab = new THREE.Vector3().subVectors(points[tri[1]], points[tri[0]]),
        ac = new THREE.Vector3().subVectors(points[tri[2]], points[tri[0]]);
      if (new THREE.Vector3().crossVectors(ab, ac).dot(normal) < 0)
        ids.reverse();
      triangles.push(...ids);
    }
  }
  return {
    vertices: new Float32Array(vertices),
    triangles: new Uint32Array(triangles),
  };
}
function geometryOnlyGLTF(buffer, binary) {
  let json, tail;
  if (binary) {
    const d = new DataView(buffer);
    if (
      d.getUint32(0, true) !== 0x46546c67 ||
      d.getUint32(4, true) !== 2 ||
      d.getUint32(16, true) !== 0x4e4f534a
    )
      throw Error('Invalid GLB 2.0 file.');
    const size = d.getUint32(12, true);
    json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 20, size)),
    );
    tail = new Uint8Array(buffer, 20 + size);
  } else json = JSON.parse(new TextDecoder().decode(buffer));
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  delete json.materials;
  delete json.textures;
  delete json.images;
  delete json.samplers;
  if (!binary) return JSON.stringify(json);
  const bytes = new TextEncoder().encode(JSON.stringify(json)),
    length = Math.ceil(bytes.length / 4) * 4,
    out = new Uint8Array(20 + length + tail.length),
    d = new DataView(out.buffer);
  d.setUint32(0, 0x46546c67, true);
  d.setUint32(4, 2, true);
  d.setUint32(8, out.length, true);
  d.setUint32(12, length, true);
  d.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + length);
  out.set(bytes, 20);
  out.set(tail, 20 + length);
  return out.buffer;
}
export async function importFile(
  file,
  companions = [],
  onCADWorker = () => {},
  onProgress = () => {},
  signal,
) {
  if (file.size > LIMITS.fileBytes) throw Error('Maximum file size is 50 MB.');
  const ext = file.name.split('.').at(-1).toLowerCase();
  if (!extensions.includes(ext))
    throw Error(
      'Unsupported format. Export STL, STEP, OBJ, 3MF, PLY, AMF, OFF, glTF/GLB, DAE or FBX.',
    );
  const buffer = await file.arrayBuffer(),
    nativeBuffer = ['step', 'stp', 'brep', 'brp'].includes(ext)
      ? buffer.slice(0)
      : null,
    text = () => new TextDecoder().decode(buffer);
  let data,
    preview = null,
    unitScale = 1,
    unitNote =
      'No reliable units in this format; defaulting to millimetres. Check the dimensions.';
  if (['step', 'stp', 'iges', 'igs', 'brep', 'brp'].includes(ext)) {
    const worker = new Worker('./cad-worker.js?v=cad-preview-1');
    onCADWorker(worker);
    const format = ['step', 'stp'].includes(ext)
      ? 'step'
      : ['iges', 'igs'].includes(ext)
        ? 'iges'
        : 'brep';
    let timer;
    let abort;
    const payload = await new Promise((resolve, reject) => {
      const fail = (message) => reject(Error(message));
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            fail(
              'CAD import did not finish this stage within three minutes. Cancelled to keep the page responsive; you can choose the file again.',
            ),
          180000,
        );
      };
      abort = () => reject(new DOMException('Cancelled', 'AbortError'));
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }) => {
        if (data.progress) {
          arm();
          onProgress(data.progress);
          return;
        }
        if (data.error) reject(Error(data.error));
        else if (data.result) resolve(data);
        else fail('The CAD importer returned an incomplete response.');
      };
      worker.onerror = () =>
        fail(
          'The CAD engine could not start or ran out of memory. Reload this page and try the file again.',
        );
      worker.onmessageerror = () =>
        fail('The browser could not receive the CAD preview.');
      arm();
      onProgress('Starting the CAD importer…');
      worker.postMessage({ format, buffer }, [buffer]);
    }).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      onCADWorker(null);
    });
    const imported = payload.result;
    preview = payload.preview;
    data = combine(
      imported.meshes.map((m) => ({
        vertices: m.attributes.position.array,
        triangles: m.index.array,
      })),
    );
    unitNote =
      format === 'brep'
        ? 'Native BREP; assumed millimetres. STEP export preserves CAD geometry.'
        : format === 'step'
          ? 'Native STEP; file units converted to millimetres. STEP export preserves CAD geometry.'
          : 'IGES uses mesh conversion. Use STEP to preserve native CAD surfaces.';
    unitNote += ` Preview deviation: ${payload.preview.deflectionMM} mm${payload.preview.adapted ? ' (automatically adapted)' : ''}.`;
    if (nativeBuffer)
      unitNote +=
        ' Original CAD geometry retained for native conversion and STEP export.';
  } else if (ext === '3mf') {
    data = parse3MF(buffer);
    unitNote =
      '3MF file units and assembly transforms applied; coordinates are millimetres.';
  } else if (ext === 'off') data = parseOFF(text());
  else if (['stl', 'ply'].includes(ext)) {
    const name = ext === 'stl' ? 'STLLoader' : 'PLYLoader',
      mod = await import(`./vendor/three/loaders/${name}.js`),
      g = new mod[name]().parse(buffer);
    data = geometryData(g);
    g.dispose();
  } else {
    const urls = [],
      manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (url.startsWith('data:') || url.startsWith('blob:')) return url;
      if (url.startsWith('./vendor/three/libs/draco/')) return url;
      const decoded = decodeURIComponent(url),
        name = decoded.split('/').at(-1),
        match =
          companions.find(
            (f) => (f.webkitRelativePath || f.name) === decoded,
          ) || companions.find((f) => f.name === name);
      if (!match && /\.(png|jpe?g|webp|gif|tga|bmp)(?:[?#].*)?$/i.test(name))
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
      if (!match)
        throw Error(
          'Missing companion file: ' +
            name +
            '. Select it together with the model. Remote references are not fetched.',
        );
      const local = URL.createObjectURL(match);
      urls.push(local);
      return local;
    });
    let scene, draco;
    try {
      if (ext === 'obj') {
        const { OBJLoader } =
          await import('./vendor/three/loaders/OBJLoader.js');
        scene = new OBJLoader(manager).parse(text());
      } else if (ext === 'amf') {
        const { AMFLoader } =
          await import('./vendor/three/loaders/AMFLoader.js');
        scene = new AMFLoader(manager).parse(buffer);
        unitNote = 'AMF declared units converted to millimetres.';
      } else if (ext === 'dae') {
        const { ColladaLoader } =
          await import('./vendor/three/loaders/ColladaLoader.js');
        scene = new ColladaLoader(manager).parse(text(), '').scene;
        unitScale = 1000;
        unitNote =
          'COLLADA declared units converted through metres to millimetres.';
      } else if (ext === 'fbx') {
        const { FBXLoader } =
          await import('./vendor/three/loaders/FBXLoader.js');
        scene = new FBXLoader(manager).parse(buffer, '');
        unitNote =
          'FBX units are not inferred. Choose the source units and verify dimensions.';
      } else {
        const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] =
          await Promise.all([
            import('./vendor/three/loaders/GLTFLoader.js'),
            import('./vendor/three/loaders/DRACOLoader.js'),
            import('./vendor/three/libs/meshopt_decoder.module.js'),
          ]);
        draco = new DRACOLoader(manager).setDecoderPath(
          './vendor/three/libs/draco/gltf/',
        );
        const loader = new GLTFLoader(manager)
          .setDRACOLoader(draco)
          .setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.parseAsync(
          geometryOnlyGLTF(buffer, ext === 'glb'),
          '',
        );
        scene = gltf.scene;
        unitScale = 1000;
        unitNote =
          'glTF metres converted to millimetres; static scene transforms applied.';
      }
      data = fromScene(scene);
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      draco?.dispose();
    }
  }
  return {
    ...data,
    name: file.name,
    format: ext,
    unitScale,
    unitNote,
    nativeBuffer,
    preview,
    requiresUnits: ext === 'fbx',
  };
}
export function export3MF(geometry, report) {
  const { vertices: v, triangles: t } = geometry,
    vertices = [],
    triangles = [];
  for (let i = 0; i < v.length; i += 3)
    vertices.push(`<vertex x="${v[i]}" y="${v[i + 1]}" z="${v[i + 2]}"/>`);
  for (let i = 0; i < t.length; i += 3)
    triangles.push(
      `<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`,
    );
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      ),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/conversion.json': strToU8(JSON.stringify(report, null, 2)),
    },
    { level: 6 },
  );
}
