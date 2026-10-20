import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeFoot } from '../../public/gridfinity-converter/native-cad.js';
import { clipNativeAttachmentBand } from '../../public/gridfinity-converter/native-contact.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const oc = cad.getOC();
function intersect(a, b) {
  const op = new oc.BRepAlgoAPI_Common(), args = new oc.NCollection_List_TopoDS_Shape(), tools = new oc.NCollection_List_TopoDS_Shape();
  try {
    args.Append(a.wrapped); tools.Append(b.wrapped);
    op.SetArguments(args); op.SetTools(tools); op.SetNonDestructive(true);
    op.SetFuzzyValue(0.00001); op.Build();
    assert.equal(op.IsDone(), true);
    return cad.cast(op.Shape());
  } finally { op.delete(); args.delete(); tools.delete(); }
}
const checks = [];
async function compare(name, source, feet, fit = 0) {
  const start = performance.now();
  const band = clipNativeAttachmentBand({ cad, intersect, source, feet, bottom: 0, height: 4.75 });
  try {
    const differences = [];
    for (const { x, y } of feet) {
      const foot = await nativeFoot(x, y, 0, 4.77, fit);
      const slice = cad.makeBox([x - 21, y - 21, 4.75], [x + 21, y + 21, 4.77]);
      const oldSlice = intersect(source, slice), oldContact = intersect(oldSlice, foot);
      const newSlice = intersect(band, slice), newContact = intersect(newSlice, foot);
      try {
        const expected = Math.abs(cad.measureVolume(oldContact)), actual = Math.abs(cad.measureVolume(newContact));
        assert.ok(Math.abs(expected - actual) < 1e-8, `${name}: contact changed ${expected} → ${actual}`);
        assert.equal(actual >= 0.02, expected >= 0.02, `${name}: contact acceptance changed`);
        differences.push(actual - expected);
      } finally { foot.delete(); slice.delete(); oldSlice.delete(); oldContact.delete(); newSlice.delete(); newContact.delete(); }
    }
    checks.push({ name, differences, elapsedMS: performance.now() - start });
  } finally { band.delete(); }
}
const positions = [-21, 21].flatMap(x => [-21, 21].map(y => ({ x, y })));
let source = cad.makeBox([-41.75, -41.75, 4.75], [41.75, 41.75, 20]);
for (const { x, y } of positions) source = source.fuse(await nativeFoot(x, y));
await compare('four solid attachments', source, positions);
await compare('partial selection, positive maximum fit', source, [positions[0], positions[3]], 0.5);
await compare('negative maximum fit', source, positions, -0.5);
await compare('shifted replacement centers', source, positions.map(({x,y})=>({x:x+0.4,y:y-0.3})));
await compare('missing material remains rejected', source, [{ x: 200, y: 200 }]);
const hollow = source.clone().cut(cad.makeBox([-38.75, -38.75, 1], [38.75, 38.75, 21]));
await compare('hollow perimeter attachments', hollow, positions);
if (process.env.CAD_CONTACT_FILE) {
  const file = process.env.CAD_CONTACT_FILE, bytes = fs.readFileSync(file);
  const cup = /\.brep$/i.test(file) ? cad.cast(oc.BRepToolsWrapper.Read(bytes.toString())) : await cad.importSTEP(new Blob([bytes]));
  await compare('actual pencil cup', cup, [20.75,62.75].flatMap(x=>[20.75,62.75].map(y=>({x,y}))));
  cup.delete();
}
console.log(JSON.stringify(checks, null, 2));
console.log('Shared attachment band matches the original per-foot contact calculation.');
