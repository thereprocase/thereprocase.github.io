import Module from '../gridfinity-shelves/vendor/manifold.js';
import {buildRings, buildNut, readKRM, ringParameters, binarySTL, ringHeader, nutHeader} from './kernel.js?v=rings-1';
import {zip} from '../gridfinity-drawers/zip.js';

const ready = Module().then(m => { m.setup(); return m; });
async function asset(name) {
  const response = await fetch(new URL(`assets/${name}`, import.meta.url));
  if (!response.ok) throw Error(`Could not download ${name} (HTTP ${response.status}). Check the connection and retry.`);
  return readKRM(await response.arrayBuffer());
}
const credits = p => `Kraken spool centering rings, ${p.hole} mm spool hole
Remix of Kraken by humebeam: https://www.printables.com/model/1788417-kraken-revolutionary-bambu-lab-ams
The holder core (bore and snap ribs) comes unchanged from humebeam's kraken-spool-ring-${p.stock}-mm-100.3mf.
License: CC BY-NC 4.0 https://creativecommons.org/licenses/by-nc/4.0/ (credit humebeam; non-commercial use).
Generated at https://thereprocase.github.io/kraken-rings/

Support (core) diameter ${(2 * p.support).toFixed(2)} mm; pentagon point diameter ${(2 * p.corner).toFixed(2)} mm.
Print one gear-side ring and one cap-side ring per spool, flat face down, no supports.
The gear-side ring goes between the spool and the large gear; the cap-side ring between the spool and the threaded holder cap.
`;

self.onmessage = async ({data}) => {
  try {
    self.postMessage({progress: {label: 'Loading geometry engine'}});
    if (data.kind === 'rings') {
      const p = ringParameters(data.parameters);
      const [m, core] = await Promise.all([ready, asset(`core-${p.stock}.bin`)]);
      self.postMessage({progress: {label: `Building ${p.hole} mm rings on the ${p.stock} mm holder core`}});
      const result = buildRings(m, core, data.parameters);
      for (const [side, part] of Object.entries(result.parts)) part.stl = binarySTL(part, ringHeader(result.parameters, side));
      const files = Object.values(result.parts).map(part => [part.stem + '.stl', part.stl]);
      result.zip = new Uint8Array(await zip([...files, ['CREDITS-AND-LICENSE.txt', credits(result.parameters)]]).arrayBuffer());
      self.postMessage({result}, [result.zip.buffer, ...Object.values(result.parts).flatMap(x => [x.vertices.buffer, x.triangles.buffer])]);
    } else if (data.kind === 'nut') {
      const [m, nut] = await Promise.all([ready, asset('nut.bin')]);
      self.postMessage({progress: {label: 'Extending the flange and thread'}});
      const result = buildNut(m, nut, data.parameters);
      result.part.stl = binarySTL(result.part, nutHeader(result.parameters));
      self.postMessage({result}, [result.part.vertices.buffer, result.part.triangles.buffer]);
    } else throw Error('Unknown job.');
  } catch (e) { self.postMessage({error: e.message}); }
};
