import { demo } from './demo.js?v=converter-1';
import Module from '../gridfinity-shelves/vendor/manifold.js';
import {
  importSolid,
  meshData,
  detect,
  align,
  convert,
} from './kernel.js?v=converter-1';
const ready = Module().then((m) => {
  m.setup();
  return m;
});
let bodies = [],
  detection,
  aligned,
  bodyIndex = 0;
function clear() {
  aligned?.delete();
  aligned = null;
  detection = null;
  bodies.forEach((b) => b.delete());
  bodies = [];
}

self.onmessage = async ({ data }) => {
  const id = data.id;
  try {
    const m = await ready;
    let result;
    if (data.type === 'load' || data.type === 'demo') {
      clear();
      const raw = data.type === 'demo' ? demo(m) : data.geometry,
        loaded = importSolid(m, raw, data.scale ?? 1);
      bodies = loaded.bodies;
      bodyIndex = 0;
      result = {
        bodies: bodies.map((s, i) => ({
          index: i,
          volume: s.volume(),
          bounds: s.boundingBox(),
          triangles: s.numTri(),
        })),
        geometry: meshData(bodies[0]),
        merged: loaded.merged,
      };
    } else if (data.type === 'detect') {
      if (!bodies.length) throw Error('Load a model first.');
      bodyIndex = data.bodyIndex ?? 0;
      if (!bodies[bodyIndex]) throw Error('Choose a valid solid.');
      aligned?.delete();
      aligned = null;
      detection = detect(m, bodies[bodyIndex], data.options);
      aligned = align(m, bodies[bodyIndex], detection);
      detection.geometry = meshData(aligned);
      result = detection;
    } else if (data.type === 'convert') {
      if (!aligned || !detection)
        throw Error('Detect or position the feet first.');
      result = convert(m, aligned, data.options);
    } else throw Error('Unknown geometry operation.');
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};
