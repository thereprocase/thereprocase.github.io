import fs from 'node:fs';
import Module from '../../public/gridfinity-shelves/vendor/manifold.js';
import { demo } from '../../public/gridfinity-converter/demo.js';
import { binarySTL } from '../../public/gridfinity-converter/kernel.js';
import { facetedSTEP } from '../../public/gridfinity-shelves/solid-exports.js';
const dir = process.argv[2];
fs.mkdirSync(dir, { recursive: true });
const m = await Module();
m.setup();
const g = demo(m),
  v = Array.from(g.vertices),
  t = Array.from(g.triangles),
  rows = (a, n) =>
    Array.from({ length: a.length / n }, (_, i) => a.slice(i * n, (i + 1) * n));
fs.writeFileSync(dir + '/part.stl', Buffer.from(binarySTL(g)));
fs.writeFileSync(
  dir + '/part.step',
  facetedSTEP(
    {
      parts: [{ name: 'bin', ...g }],
      parameters: { base_type: 'weighted' },
      volume: g.volume,
    },
    m,
  ),
);
fs.writeFileSync(
  dir + '/part.obj',
  rows(v, 3)
    .map((p) => 'v ' + p.join(' '))
    .concat(rows(t, 3).map((p) => 'f ' + p.map((i) => i + 1).join(' ')))
    .join('\n'),
);
fs.writeFileSync(
  dir + '/part.off',
  'OFF\n' +
    v.length / 3 +
    ' ' +
    t.length / 3 +
    ' 0\n' +
    rows(v, 3)
      .map((p) => p.join(' '))
      .concat(rows(t, 3).map((p) => '3 ' + p.join(' ')))
      .join('\n'),
);
fs.writeFileSync(
  dir + '/part.ply',
  `ply\nformat ascii 1.0\nelement vertex ${v.length / 3}\nproperty float x\nproperty float y\nproperty float z\nelement face ${t.length / 3}\nproperty list uchar int vertex_indices\nend_header\n` +
    rows(v, 3)
      .map((p) => p.join(' '))
      .concat(rows(t, 3).map((p) => '3 ' + p.join(' ')))
      .join('\n'),
);
fs.writeFileSync(
  dir + '/part.amf',
  `<amf unit="millimeter"><object id="0"><mesh><vertices>${rows(v, 3)
    .map(
      (p) =>
        '<vertex><coordinates>' +
        p.map((x, i) => `<${'xyz'[i]}>${x}</${'xyz'[i]}>`).join('') +
        '</coordinates></vertex>',
    )
    .join('')}</vertices><volume>${rows(t, 3)
    .map(
      (p) =>
        '<triangle>' +
        p.map((x, i) => `<v${i + 1}>${x}</v${i + 1}>`).join('') +
        '</triangle>',
    )
    .join('')}</volume></mesh></object></amf>`,
);
const pos = new Float32Array(v.map((x) => x / 1000)),
  bin = Buffer.concat([
    Buffer.from(pos.buffer),
    Buffer.from(g.triangles.buffer),
  ]),
  json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [0.1, 0.02, 0.03] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length, uri: 'part.bin' }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
      {
        buffer: 0,
        byteOffset: pos.byteLength,
        byteLength: g.triangles.byteLength,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: v.length / 3,
        type: 'VEC3',
        min: g.bounds.min.map((x) => x / 1000),
        max: g.bounds.max.map((x) => x / 1000),
      },
      { bufferView: 1, componentType: 5125, count: t.length, type: 'SCALAR' },
    ],
  };
fs.writeFileSync(dir + '/part.bin', bin);
fs.writeFileSync(dir + '/part.gltf', JSON.stringify(json));
delete json.buffers[0].uri;
let j = Buffer.from(JSON.stringify(json));
j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 32)]);
const head = Buffer.alloc(20);
head.writeUInt32LE(0x46546c67);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(28 + j.length + bin.length, 8);
head.writeUInt32LE(j.length, 12);
head.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(dir + '/part.glb', Buffer.concat([head, j, bh, bin]));
fs.writeFileSync(
  dir + '/mesh.json',
  JSON.stringify({ vertices: v, triangles: t }),
);
